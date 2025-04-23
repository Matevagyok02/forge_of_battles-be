import {Battle} from "../models/Battle";
import {Ability, AbilityUsageType, InstantAbility} from "../models/Abilities";
import {PlayerState, BattlefieldPos} from "../models/PlayerState";
import {BattleService} from "./BattleService";
import {Card} from "../models/Card";

export class AbilityService {

    static async executeAbility(battle: Battle, ability: InstantAbility) {
        const abilityFunction = this.abilities.get(ability.name);
        if (abilityFunction) {
            await abilityFunction(battle, ability);
        }
    }

    /** Basic instant abilities */
    private static heal = (battle: Battle, ability: InstantAbility) => {
        const player = battle.player(ability.cardHolderId!);
        const amountToHeal = this.getValue("heal", ability.args);
        if (player && amountToHeal) {
            for (let i = 0; i < amountToHeal; i++) {
                const card = player.casualties.pop();
                if (card) {
                    player.bonusHealth.push(card);
                }
            }
        }
    }

    private static forceDiscard = (battle: Battle, ability: InstantAbility, amount?: number) => {
        const amountToDiscard = amount ? amount : this.getValue("discard", ability.args);
        battle.abilities.addDiscardRequirement(battle.getOpponentId(ability.cardHolderId!), amountToDiscard, false);
    }

    private static forceSacrifice = (battle: Battle, ability: InstantAbility) => {
        battle.abilities.addDiscardRequirement(battle.getOpponentId(ability.cardHolderId!), 1, true);
    }

    private static forceDiscardIfNoDefender = (battle: Battle, ability: InstantAbility) => {
        const opponent = battle.opponent(ability.cardHolderId!);

        if (opponent && !opponent.deployedCards.has(BattlefieldPos.defender)) {
            this.forceDiscard(battle, ability);
        }
    }

    private static raise = (battle: Battle, ability: InstantAbility) => {
        const player = battle.player(ability.cardHolderId!);
        const opponent = battle.opponent(ability.cardHolderId!);
        const amountToRaise = this.getValue("raise", ability.args);

        if (player && opponent) {
            for (let i = 0; i < amountToRaise; i++) {
                const card = opponent.casualties.pop();
                if (card) {
                    player.onHand.push(card);
                }
            }
        }
    }

    private static raiseZombie = (battle: Battle, ability: InstantAbility) => {
        const player = battle.player(ability.cardHolderId!);

        if (player) {
            const zombieCardIndex = player.casualties.indexOf(ability.cardId);

            if (zombieCardIndex > -1) {
                player.casualties.splice(zombieCardIndex, 1);
                player.onHand.push(ability.cardId);
            }
        }
    }

    private static returnChosenCasualtyToHand = (battle: Battle, ability: InstantAbility) => {
        const player = battle.player(ability.cardHolderId!);

        if (player) {
            ability.targetCards?.forEach(card => {
                const index= player.casualties.indexOf(card);
                if (index > -1) {
                    player.casualties.splice(index, 1);
                    player.onHand.push(card);
                }
            })
        }
    }

    private static raiseAttackByManaAmount = (battle: Battle, ability: InstantAbility) => {
        const player = battle.player(ability.cardHolderId!);
        const target = ability.targetPositions?.self[0];

        if (player && target) {
            const card = player.deployedCards.get(target);
            if (card) {
                card.attack += player.manaCards.length;
            }
        }
    }

    private static deployCardFromDrawingDeck = async (battle: Battle, ability: InstantAbility) => {
        const player = battle.player(ability.cardHolderId!);
        const cardId = player?.drawingDeck[player?.drawingDeck.length -1];

        if (cardId && player) {
            const card = await BattleService.getCardById(cardId);
            if (card) {
                player.drawingDeck.pop();
                await player.deploy(card, undefined, true);
            }
        }
    }

    private static deployCasualtyFree = async (battle: Battle, ability: InstantAbility) => {
        const player = battle.player(ability.cardHolderId!);
        const cardId = player?.drawingDeck[player?.drawingDeck.length -1];

        if (cardId && player) {
            const card = await BattleService.getCardById(cardId);
            if (card) {
                player.casualties.pop();
                await player.deploy(card, undefined, true);
            }
        }
    }

    private static dealDamage = (battle: Battle, ability: InstantAbility, damage?: number) => {
        const opponent = battle.opponent(ability.cardHolderId!);
        const amount = damage ? damage : this.getValue("damage", ability.args);

        if (opponent) {
            opponent.receiveDamage(amount);
        }
    }

    private static berserkerKill = async (battle: Battle, ability: InstantAbility) => {
        const opponent = battle.opponent(ability.cardHolderId!);
        const targetPos = ability.targetPositions?.opponent[0];

        const player = battle.player(ability.cardHolderId!);
        let berserkerDamage = 0;
        player?.deployedCards.forEach(card => {
            if (card.id === ability.cardId) {
                berserkerDamage = card.attack;
            }
        });

        if (opponent && targetPos) {
            const targetCard = opponent?.deployedCards.get(targetPos);
            if (targetCard && targetCard.defence < berserkerDamage) {
                await opponent.addToCasualties(targetPos);
            }
        }
    }

    private static stealTopResource = (battle: Battle, ability: InstantAbility) => {
        const opponent = battle.opponent(ability.cardHolderId!);
        const player = battle.player(ability.cardHolderId!);

        if (opponent && player) {
            const card = opponent.drawingDeck.pop();
            if (card) {
                player.drawingDeck.unshift(card);
            }
        }
    }

    private static stealFromHand = (battle: Battle, ability: InstantAbility) => {
        const opponent = battle.opponent(ability.cardHolderId!);
        const player = battle.player(ability.cardHolderId!);

        if (opponent && player) {
            const card = opponent.onHand[Math.floor(Math.random() * opponent.onHand.length)];
                if (card) {
                    opponent.onHand.splice(opponent.onHand.indexOf(card, 1));
                    player.onHand.push(card);
                }
        }
    }

    private static stealFromTrack = (battle: Battle, ability: InstantAbility) => {
        const player = battle.player(ability.cardHolderId!);
        const opponent = battle.opponent(ability.cardHolderId!);
        const target = ability.targetPositions?.opponent[0];

        if (player && opponent && target) {
            const card = opponent.deployedCards.get(target);

            if (card) {
                opponent.removeBasicAndEventDrivenAbilities(card.passiveAbility);
                opponent.deployedCards.delete(target);
                player.drawingDeck.unshift(card.id);
            }
        }
    }

    private static moveCardToPos = (battle: Battle, ability: InstantAbility) => {
        const player = battle.player(ability.cardHolderId!);
        const pos = ability.targetPositions?.self;

        if (player && pos && pos.length === 2) {
            const defaultPos = pos[0];
            const moveToPos = pos[1];
            if (!player.deployedCards.has(moveToPos) && player.deployedCards.has(defaultPos)) {
                player.deployedCards.set(moveToPos, player.deployedCards.get(defaultPos)!);
                player.deployedCards.delete(defaultPos);
            }
        }
    }

    private static stormWithCardOnTrack = (battle: Battle, ability: InstantAbility) => {
        const player = battle.player(ability.cardHolderId!);
        const target = ability.targetPositions?.self[0];

        if (player && target) {
            const nextStormer = player.deployedCards.get(target);

            if (nextStormer) {
                AbilityService.setNewStormer(player, nextStormer);
            }
        }
    }

    private static stormWithSacrificedCard = (battle: Battle, ability: InstantAbility) => {
        const player = battle.player(ability.cardHolderId!);

        if (player) {
            const cardId = player.casualties.pop();

            if (cardId) {
                BattleService.getCardById(cardId).then(nextStormer => {
                    if (nextStormer) {
                        AbilityService.setNewStormer(player, nextStormer);
                    }
                });
            }
        }
    }

    private static setNewStormer = async (player: PlayerState, nextStormer: Card) => {
        const currentStormer = player.deployedCards.get(BattlefieldPos.stormer);

        if (nextStormer && currentStormer) {
            player.clearCard();
            player.deployedCards.set(BattlefieldPos.stormer, nextStormer);

            if (
                nextStormer.passiveAbility.usageType === AbilityUsageType.basic
                || nextStormer.passiveAbility.usageType === AbilityUsageType.eventDriven
            ) {
                await player.battle!.abilities.addAbility(player.id, nextStormer.passiveAbility);
            }
        }
    }

    private static ignoreDefenceAtStorm = (battle: Battle, ability: InstantAbility) => {
        const opponent = battle.opponent(ability.cardHolderId!);

        if (opponent) {
            const defender = opponent.deployedCards.get(BattlefieldPos.defender);
            if (defender) {
                opponent.receiveDamage(defender.defence);
            }
        }
    }

    private static killIfLowDefence = (battle: Battle, ability: InstantAbility) => {
        const opponent = battle.opponent(ability.cardHolderId!);

        if (opponent) {
            for (const [pos, card] of opponent.deployedCards.entries()) {
                if (card.defence < 2) {
                    opponent.addToCasualties(pos);
                }
            }
        }
    }

    private static draw = (battle: Battle, ability: InstantAbility) => {
        const player = battle.player(ability.cardHolderId!);
        const amount = this.getValue("draw", ability.args);

        if (player) {
            for (let i = 0; i < amount; i++) {
                const card = player.drawingDeck.pop();
                if (card) {
                    player.onHand.push(card);
                }
            }
        }
    }

    private static cancelPassiveAbility = (battle: Battle, ability: InstantAbility) => {
        const targets = ability.targetPositions;
        let targetCardAbility: Ability | undefined;

        if (targets && targets.self.length > 0) {
            targetCardAbility = battle.player(ability.cardHolderId!)?.deployedCards.get(targets.self[0])?.passiveAbility;
        }
        else if (targets && targets.opponent.length > 0) {
            targetCardAbility = battle.opponent(ability.cardHolderId!)?.deployedCards.get(targets.opponent[0])?.passiveAbility;
        } else {
            return;
        }

        if (targetCardAbility) {
            battle.abilities.removePassiveAbility(targetCardAbility.cardHolderId!, targetCardAbility.cardId);
        }
    }

    private static removeActionAbility = (battle: Battle, ability: InstantAbility) => {
        const targets = ability.targetPositions;
        let targetCard: Card | undefined;

        if (targets && targets.self.length > 0) {
            targetCard = battle.player(ability.cardHolderId!)?.deployedCards.get(targets.self[0]);
        }
        else if (targets && targets.opponent.length > 0) {
            targetCard = battle.opponent(ability.cardHolderId!)?.deployedCards.get(targets.opponent[0]);
        } else {
            return;
        }

        if (targetCard) {
            targetCard.actionAbility = undefined;
        }
    }

    private static removeMana = (battle: Battle, ability: InstantAbility) => {
        const opponent = battle.opponent(ability.cardHolderId!);

        if (opponent) {
            opponent.removeMana();
        }
    }

    private static returnCasualtyAsMana = (battle: Battle, ability: InstantAbility) => {
        const player = battle.player(ability.cardHolderId!);

        if (player) {
            const card = player.casualties.pop();
            if (card) {
                player.addMana([card]);
            }
        }
    }

    private static forceDiscardForEachMana = (battle: Battle, ability: InstantAbility) => {
        const player = battle.player(ability.cardHolderId!);
        const amount = player?.manaCards.length;

        if (amount) {
            AbilityService.forceDiscard(battle, ability, amount);
        }
    }

    private static dealDamageIfNoAllies = (battle: Battle, ability: InstantAbility) => {
        const player = battle.player(ability.cardHolderId!);

        if (player) {
            const dep = player.deployedCards;

            if (!dep.has(BattlefieldPos.attacker) && !dep.has(BattlefieldPos.supporter) && !dep.has(BattlefieldPos.defender)) {
                AbilityService.dealDamage(battle, ability);
            }
        }
    }

    private static deployCardForFree = async (battle: Battle, ability: InstantAbility) => {
        const player = battle.player(ability.cardHolderId!);
        const target = ability.targetCards ? ability.targetCards[0] : undefined;

        if (player && target) {
            const card = await BattleService.getCardById(target);
            if (card) {
                await player.deploy(card, undefined, true);
            }
        }
    }

    private static stealCardAndAddToMana = (battle: Battle, ability: InstantAbility) => {
        const player = battle.player(ability.cardHolderId!);
        const opponent = battle.opponent(ability.cardHolderId!);

        if (player && opponent) {
            const card = opponent.onHand[Math.floor(Math.random() * opponent.onHand.length)];
            if (card) {
                opponent.onHand.splice(opponent.onHand.indexOf(card, 1));
                player.addMana([card]);
            }
        }
}

    private static stealTopResourceAndDeploy = async (battle: Battle, ability: InstantAbility) => {
        const player = battle.player(ability.cardHolderId!);
        const opponent = battle.opponent(ability.cardHolderId!);

        if (player && opponent) {
            const cardId = opponent.drawingDeck.pop();
            if (cardId) {
                const card = await BattleService.getCardById(cardId);
                if (card) {
                    await player.deploy(card, undefined, true);
                }
            }
        }
    }

    private static removeAllCardsAndAddThemToMana = (battle: Battle, ability: InstantAbility) => {
        const player = battle.player(ability.cardHolderId!);
        const opponent = battle.opponent(ability.cardHolderId!);
        const positions = [BattlefieldPos.attacker, BattlefieldPos.supporter, BattlefieldPos.defender]; //TODO: add middle positions?

        if (player && opponent) {
            positions.forEach(pos => {
                player.addToMana(pos, true);
                opponent.addToMana(pos, true);
            });
        }
    }

    private static loseCardsFromHand = (battle: Battle, ability: InstantAbility) => {
        const opponent = battle.opponent(ability.cardHolderId!);

        if (opponent) {
            const onHand = opponent.onHand;
            opponent.drawingDeck.push(...onHand);
            opponent.onHand.splice(0, Infinity);
        }
    }

    private static removeCasualtiesPermanently = (battle: Battle, ability: InstantAbility) => {
        const opponent = battle.opponent(ability.cardHolderId!);

        if (opponent) {
            opponent.casualties.splice(0, Infinity);
        }
    }

    private static returnToDrawingDeck = (battle: Battle, ability: InstantAbility) => {
        const player = battle.player(ability.cardHolderId!);

        if (player) {
            player.drawingDeck.push(ability.cardId);
        }
    }

    private static switchCards = (battle: Battle, ability: InstantAbility) => {
        const targets = ability.targetPositions;
        let target1: Card | undefined;
        let target2: Card | undefined;

        if (targets && targets.self.length === 2) {
            const player = battle.player(ability.cardHolderId!);

            if (player) {
                target1 = player.deployedCards.get(targets.self[0]);
                target2 = player.deployedCards.get(targets.self[1]);

                if (target1 && target2) {
                    player.deployedCards.set(targets.self[0], target2);
                    player.deployedCards.set(targets.self[1], target1);
                }
            }
        }
        else if (targets && targets.opponent.length === 2) {
            const opponent = battle.opponent(ability.cardHolderId!);

            if (opponent) {
                target1 = opponent.deployedCards.get(targets.opponent[0]);
                target2 = opponent.deployedCards.get(targets.opponent[1]);

                if (target1 && target2) {
                    opponent.deployedCards.set(targets.opponent[0], target2);
                    opponent.deployedCards.set(targets.opponent[1], target1);
                }
            }
        } else {
            return;
        }
    }

    private static addToManaAfterStorm = (battle: Battle, ability: InstantAbility) => {
        const player = battle.player(ability.cardHolderId!);

        if (player) {
            player.addToMana();
        }
    }

    private static dealDamageEqualToCardsInHand = (battle: Battle, ability: InstantAbility) => {
        const player = battle.player(ability.cardHolderId!);

        if (player) {
            this.dealDamage(battle, ability, player.onHand.length)
        }
    }

    private static dealDamageEqualToZombies = (battle: Battle, ability: InstantAbility) => {
        const player = battle.player(ability.cardHolderId!);
        const damageAmount = this.getValue("damage", ability.args);
        let zombieCardsAmount = 0;

        if (player) {
            player.deployedCards.forEach(card => {
               if (card.id === ability.cardId)
                   zombieCardsAmount++;
            });
            this.dealDamage(battle, ability, zombieCardsAmount * (damageAmount ? damageAmount : 1));
        }
    }

    private static removeCardAndAddToMana = (battle: Battle, ability: InstantAbility) => {
        const targets = ability.targetPositions;
        let target;
        let player;

        if (targets) {
            if (targets.opponent.length > 0) {
                player = battle.opponent(ability.cardHolderId!);
                target = targets.opponent[0];
            }
            else if (targets.self.length > 0) {
                player = battle.player(ability.cardHolderId!);
                target = targets.self[0];
            }

            if (player && target) {
                player.addToMana(target, true);
            }
        }
    }

    private static damageIfMoreThan3Mana = (battle: Battle, ability: InstantAbility) => {
        const opponent = battle.opponent(ability.cardHolderId!);

        if (opponent && opponent.manaCards.length >= 3) {
            opponent?.receiveDamage(4);
        }
    }

    private static returnToHandAfterStormOrKill = (battle: Battle, ability: InstantAbility) => {
        const player = battle.player(ability.cardHolderId!);

        if (player) {
            if (player.casualties.includes(ability.cardId)) {
                player.casualties.splice(player.casualties.indexOf(ability.cardId), 1);
                player.onHand.push(ability.cardId);
            }
            else if (player.deployedCards.get(BattlefieldPos.stormer)?.id === ability.cardId) {
                const cardId = player.deployedCards.get(BattlefieldPos.stormer)?.id;
                if (cardId) {
                    player.deployedCards.delete(BattlefieldPos.stormer);
                    player.onHand.push(ability.cardId);
                }
            }
        }
    }

    private static copyAndUseAction = (battle: Battle, ability: InstantAbility) => {
        const player = battle.player(ability.cardHolderId!);
        const opponent = battle.opponent(ability.cardHolderId!);
        const targets = ability.targetPositions;
        let targetCard;

        if (player && opponent && targets) {
            if (targets && targets.self.length > 0) {
                targetCard = player.deployedCards.get(targets.self[0])
            }
            else if (targets && targets.opponent.length > 0) {
                targetCard = player.deployedCards.get(targets.opponent[0]);
            } else {
                return;
            }

            if (targetCard && targetCard.actionAbility) {
                player.useAction(targetCard, ability.nestedArgs, true);
            }
        }
    }

    private static kill = (battle: Battle, ability: InstantAbility) => {
        const opponent = battle.opponent(ability.cardHolderId!);
        const targets = ability.targetPositions?.opponent;

        if (opponent && targets) {
            targets.forEach(target => {
               opponent.addToCasualties(target);
            });
        }
    }

    private static dealDamageIf2CardsOnTrack = (battle: Battle, ability: InstantAbility) => {
        const player = battle.player(ability.cardHolderId!);
        let cardsOnTrack = 0;
        const positions = [BattlefieldPos.attacker, BattlefieldPos.supporter, BattlefieldPos.defender];

        if (player) {
            positions.forEach(pos => {
               if (player.deployedCards.has(pos)) {
                   cardsOnTrack++;
               }
            });

            if (cardsOnTrack >= 2) {
                AbilityService.dealDamage(battle, ability);
            }
        }
    }

    private static dealDamageEqualToMana = (battle: Battle, ability: InstantAbility) => {
        const player = battle.player(ability.cardHolderId!);

        if (player) {
            const damageAmount = this.getValue("damage", ability.args);
            AbilityService.dealDamage(battle, ability, damageAmount ? player.manaCards.length *  damageAmount : 1);
        }
    }

    private static killIfCostLowerThan3 = async (battle: Battle, ability: InstantAbility) => {
        const opponent = battle.opponent(ability.cardHolderId!);
        const target = ability.targetPositions?.opponent[0];

        if (opponent && target) {
            const card = opponent.deployedCards.get(target);

            if (card &&card.cost <= 3) {
                await opponent.addToCasualties(target);
            }
        }
    }

    private static returnToOwnerHand = (battle: Battle, ability: InstantAbility) => {
        const targets = ability.targetPositions;
        let target;
        let player;

        if (targets) {
            if (AbilityService.isOpponentTarget(ability)) {
                player = battle.opponent(ability.cardHolderId!);
                target = targets.opponent[0];
            } else {
                player = battle.player(ability.cardHolderId!);
                target = targets.self[0];
            }

            if (player && target) {
                const card = player.deployedCards.get(target);

                if (card) {
                    player.deployedCards.delete(target);
                    player.removeBasicAndEventDrivenAbilities(card.passiveAbility);
                    player.onHand.push(card.id);
                }
            }
        }
    }

    private static dealLowestValueDamage = (battle: Battle, ability: InstantAbility) => {
        const player = battle.player(ability.cardHolderId!);
        const positions = [BattlefieldPos.stormer, BattlefieldPos.supporter, BattlefieldPos.defender];
        let lowestValue = 0;

        if (player) {
            positions.forEach(pos => {
                const card = player.deployedCards.get(pos);

                if (card && (lowestValue === 0 || card.attack < lowestValue)) {
                    lowestValue = card.attack;
                }
            });

            AbilityService.dealDamage(battle, ability, lowestValue);
        }
    }

    private static dealHighestValueDamage = (battle: Battle, ability: InstantAbility) => {
        const player = battle.player(ability.cardHolderId!);
        const positions = [BattlefieldPos.stormer, BattlefieldPos.supporter, BattlefieldPos.defender];
        let highestValue = 0;

        if (player) {
            positions.forEach(pos => {
                const card = player.deployedCards.get(pos);

                if (card && card.attack > highestValue) {
                    highestValue = card.attack;
                }
            });

            AbilityService.dealDamage(battle, ability, highestValue);
        }
    }

    private static extraTurn = (battle: Battle, ability: InstantAbility) => {
        battle.startTurn(ability.cardHolderId!);
    }

    private static deployOnFront = (battle: Battle, ability: InstantAbility) => {
        const player = battle.player(ability.cardHolderId!);
        const target = ability.targetCards ? ability.targetCards[0] : undefined;

        if (player && target && player.onHand.includes(target)) {
            const cardIndex = player.onHand.indexOf(target);

            if (cardIndex > -1) {
                BattleService.getCardById(target).then(card => {
                   if (card) {
                       player.onHand.splice(cardIndex, 1);
                       player.moveToFrontLine(card);
                   }
                });
            }
        }
    }

    private static addCasualtyToMana = (battle: Battle, ability: InstantAbility) => {
        const player = battle.player(ability.cardHolderId!);
        const amount = 2;

        if (player) {
            for (let i = 0; i < amount; i++) {
                const card = player.casualties.pop();
                if (card) {
                    player.addMana([card]);
                }
            }
        }
    }

    private static healAndAddCasualtyToMana = (battle: Battle, ability: InstantAbility) => {
        AbilityService.heal(battle, ability);
        AbilityService.addCasualtyToMana(battle, ability);
    }

    /** Combined abilities */
    private static raiseAndSteal = (battle: Battle, ability: InstantAbility) => {
        AbilityService.raise(battle, ability);
        AbilityService.stealFromHand(battle, ability);
    }

    private static raiseAndTakeExtraTurn = (battle: Battle, ability: InstantAbility) => {
        AbilityService.raise(battle, ability);
        AbilityService.extraTurn(battle, ability);
    }

    private static drawAndHeal = (battle: Battle, ability: InstantAbility) => {
        this.draw(battle, ability);
        this.heal(battle, ability);
    }

    private static killAndDraw = (battle: Battle, ability: InstantAbility) => {
        AbilityService.kill(battle, ability);
        AbilityService.draw(battle, ability);
    }

    private static drawAndForceDiscard = (battle: Battle, ability: InstantAbility) => {
        AbilityService.draw(battle, ability);
        AbilityService.forceDiscard(battle, ability);
    }

    /** Ability map */
    private static readonly abilities = new Map<string, Function>([
        [ "heal", this.heal ],
        [ "kill", this.kill ],
        [ "raise", this.raise ],
        [ "draw", this.draw ],
        [ "damage", this.dealDamage ],
        [ "forceDiscard", this.forceDiscard ],
        [ "forceSacrifice", this.forceSacrifice ],
        [ "returnToDrawingDeck", this.returnToDrawingDeck ],
        [ "returnToHandAfterStormOrKill", this.returnToHandAfterStormOrKill ],
        [ "dealDamageEqualToCardsInHand", this.dealDamageEqualToCardsInHand ],
        [ "addToManaAfterStorm", this.addToManaAfterStorm ],
        [ "switchCards", this.switchCards ],
        [ "stealFromHand", this.stealFromHand ],
        [ "stealTopResource", this.stealTopResource ],
        [ "removeMana", this.removeMana],
        [ "raiseAttackByManaAmount", this.raiseAttackByManaAmount ],
        [ "removeActionAbility", this.removeActionAbility ],
        [ "cancelPassiveAbility", this.cancelPassiveAbility],
        [ "drawAndHeal", this.drawAndHeal ],
        [ "raiseAndSteal", this.raiseAndSteal ],
        [ "killIfLowDefence", this.killIfLowDefence ],
        [ "stormWithCardOnTrack", this.stormWithCardOnTrack ],
        [ "moveCardToPos", this.moveCardToPos ],
        [ "berserkerKill", this.berserkerKill],
        [ "deployCasualtyFree", this.deployCasualtyFree ],
        [ "raiseZombie", this.raiseZombie ],
        [ "forceDiscardIfNoDefender", this.forceDiscardIfNoDefender ],
        [ "returnChosenCasualtyToHand", this.returnChosenCasualtyToHand ],
        [ "deployCardFromDrawingDeck", this.deployCardFromDrawingDeck ],
        [ "copyAndUseAction", this.copyAndUseAction ],
        [ "ignoreDefenceAtStorm", this.ignoreDefenceAtStorm ],
        [ "stealFromTrack", this.stealFromTrack ],
        [ "drawAndForceDiscard", this.drawAndForceDiscard ],
        [ "removeCasualtiesPermanently", this.removeCasualtiesPermanently ],
        [ "loseCardsFromHand", this.loseCardsFromHand ],
        [ "removeAllCardsAndAddThemToMana", this.removeAllCardsAndAddThemToMana ],
        [ "stealTopResourceAndDeploy", this.stealTopResourceAndDeploy ],
        [ "stealCardAndAddToMana", this.stealCardAndAddToMana ],
        [ "deployCardForFree", this.deployCardForFree ],
        [ "damageIfMoreThan3Mana", this.damageIfMoreThan3Mana ],
        [ "removeCardAndAddToMana", this.removeCardAndAddToMana ],
        [ "dealDamageEqualToZombies", this.dealDamageEqualToZombies ],
        [ "dealDamageIfNoAllies", this.dealDamageIfNoAllies ],
        [ "forceDiscardForEachMana", this.forceDiscardForEachMana ],
        [ "returnCasualtyAsMana", this.returnCasualtyAsMana ],
        [ "raiseAndTakeExtraTurn", this.raiseAndTakeExtraTurn ],
        [ "healAndAddCasualtyToMana", this.healAndAddCasualtyToMana ],
        [ "addCasualtyToMana", this.addCasualtyToMana ],
        [ "killAndDraw", this.killAndDraw ],
        [ "deployOnFront", this.deployOnFront ],
        [ "dealHighestValueDamage", this.dealHighestValueDamage ],
        [ "dealLowestValueDamage", this.dealLowestValueDamage ],
        [ "returnToOwnerHand", this.returnToOwnerHand ],
        [ "killIfCostLowerThan3", this.killIfCostLowerThan3 ],
        [ "dealDamageEqualToMana", this.dealDamageEqualToMana ],
        [ "dealDamageIf2CardsOnTrack", this.dealDamageIf2CardsOnTrack ],
        [ "stormWithSacrificedCard", this.stormWithSacrificedCard ]
    ]);

    /** Helper functions */
    private static getValue = (key: string, args: any) => {
        return args[key] ? args[key] : 1;
    }

    private static isOpponentTarget = (ability: InstantAbility) => {
        return ability.targetPositions && ability.targetPositions.self.length > 0
    }
}