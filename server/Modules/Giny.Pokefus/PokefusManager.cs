using Giny.Core.DesignPattern;
using Giny.ORM;
using Giny.Pokefus.Effects;
using Giny.Pokefus.Fight.Fighters;
using Giny.Protocol.Custom.Enums;
using Giny.Protocol.Enums;
using Giny.World.Managers.Effects;
using Giny.World.Managers.Entities.Characters;
using Giny.World.Managers.Fights.Cast;
using Giny.World.Managers.Fights.Fighters;
using Giny.World.Managers.Fights.Results;
using Giny.World.Managers.Items;
using Giny.World.Managers.Items.Collections;
using Giny.World.Records.Items;
using Giny.World.Records.Maps;
using Giny.World.Records.Monsters;
using Giny.World.Records.Spells;
using Giny.World.Managers.Monsters;
using System.Collections.Generic;
using System.Linq;
using Giny.Pokefus.Data.Records;
using Giny.Core;
using Giny.World.Api;
using Giny.World.Managers.Fights;
using System.Collections.Concurrent;

namespace Giny.Pokefus
{
    public class PokefusManager : Singleton<PokefusManager>
    {
        public const short MaxPokefusLevel = 200;

        /// <summary>
        /// Dedicated persisted fight-consumable slot used as the Pokéfus net slot.
        /// The official client already exposes position 31 with stack quantity.
        /// </summary>
        public const CharacterInventoryPositionEnum CaptureNetPosition =
            CharacterInventoryPositionEnum.INVENTORY_POSITION_CONSUMABLE;

        /// <summary>
        /// Maximum active pokéfus in the team. Fight experience is split between them.
        /// Slots use free inventory positions so multiple SIDEKICK items can be equipped.
        /// </summary>
        public const int MaxActivePokefus = 3;

        /// <summary>
        /// Inventory positions used as the 3 active pokéfus slots.
        /// They are bonus/malus buffers unused by normal equipment.
        /// </summary>
        public static readonly CharacterInventoryPositionEnum[] PokefusPositions =
        {
            CharacterInventoryPositionEnum.INVENTORY_POSITION_FIRST_BONUS,      // 22
            CharacterInventoryPositionEnum.INVENTORY_POSITION_SECOND_BONUS,     // 23
            CharacterInventoryPositionEnum.INVENTORY_POSITION_FIRST_MALUS,      // 24
        };

        private const string PokefusLevelRequirementMessage = "Vous devez être niveau {0} pour pouvoir équiper ce pokéfus.";
        private const string PokefusTeamFullMessage = "Votre équipe de pokéfus est pleine ({0}/{0}).";
        private const string PokefusLevelUpMessage = "Felicitation ! Votre Pokefus <b>{0}</b> passe niveau <b>{1}</b>.";
        private const string CannotCastMessage = "Le sort : {0} ne peut pas être lancé par un pokéfus.";
        private const string CaptureModeOnMessage = "Mode capture Pokéfus activé.";
        private const string CaptureModeOffMessage = "Mode capture Pokéfus désactivé.";
        private const string NoNetMessage = "Aucun filet de capture équipé.";
        private const string NetRangeMessage = "Ce filet permet de capturer des Pokéfus de niveau {0} à {1}.";
        private const string CaptureFailMessage = "Le Pokéfus s'est échappé !";
        private const string CaptureSuccessMessage = "Vous avez capturé : {0} !";
        private const string CaptureSuccessLegendaryMessage = "Vous avez capturé : {0} légendaire !";
        private const string CaptureSlotOnlyNetsMessage = "Ce slot n'accepte que les filets de capture Pokéfus.";

        private readonly ConcurrentDictionary<long, bool> captureModes = new();

        private static EffectsEnum[] ForbiddenPokefusSpellEffects = new EffectsEnum[]
        {
            EffectsEnum.Effect_Kill,
            EffectsEnum.Effect_KillAndSummon,
            EffectsEnum.Effect_KillAndSummonSlave,
        };

        private static short[] ForbiddenPokefusSpells = new short[]
        {
            411, // Tuerie
            228, // Etourderie Mortelle
            1037, // Briss Deuniss
            14757, // Sort tot
            914, // Invocation Poutch
        };

        public void Initialize()
        {
            // Monster groups are initially spawned before module hooks are
            // installed. Apply the same authoritative group roll to those groups
            // once the database-backed Pokéfus configuration is available.
            AssignStatusToExistingGroups();
        }

        public void OnMonsterGroupGenerated(MonsterGroup group)
        {
            AssignPokefusStatus(group, Random.Shared);
        }

        private void AssignStatusToExistingGroups()
        {
            foreach (MapRecord map in MapRecord.GetMaps())
            {
                if (map.Instance == null)
                    continue;

                foreach (MonsterGroup group in map.Instance.GetEntities<MonsterGroup>())
                {
                    AssignPokefusStatus(group, Random.Shared);
                }
            }
        }

        /// <summary>
        /// Performs two independent group-level rolls. The legendary result wins
        /// when both rolls succeed, so it replaces the normal result while keeping
        /// its own direct probability. The candidate is selected once from the
        /// eligible instances, enforcing the one-Pokéfus-per-group invariant.
        /// </summary>
        public void AssignPokefusStatus(MonsterGroup group, Random random)
        {
            if (group == null || group.GetMonsters().Any(x => x.IsPokefus))
                return;

            Monster[] eligible = group.GetMonsters()
                .Where(x => x.Record != null)
                .Where(x => PokefusSpeciesRecord.GetSpeciesByMonster(x.Record.Id) is PokefusSpeciesRecord species &&
                            species.Enabled && species.SpawnEligible)
                .ToArray();

            if (eligible.Length == 0)
                return;

            PokefusCaptureConfigurationRecord configuration = PokefusCaptureConfigurationRecord.Current;
            double legendaryRate = Math.Clamp(configuration.LegendarySpawnRate, 0d, 1d);
            double normalRate = Math.Clamp(configuration.NormalSpawnRate, 0d, 1d);

            bool legendaryRoll = random.NextDouble() < legendaryRate;
            bool normalRoll = random.NextDouble() < normalRate;
            if (!legendaryRoll && !normalRoll)
            {
                return;
            }

            PokefusStatusEnum status = legendaryRoll
                ? PokefusStatusEnum.POKEFUS_LEGENDARY
                : PokefusStatusEnum.POKEFUS_NORMAL;
            eligible[random.Next(eligible.Length)].SetPokefusStatus(status);
        }

        public static bool IsPokefusPosition(CharacterInventoryPositionEnum position)
        {
            return PokefusPositions.Contains(position);
        }

        public static bool IsCaptureNetPosition(CharacterInventoryPositionEnum position)
        {
            return position == CaptureNetPosition;
        }

        public bool IsCaptureModeEnabled(Character character)
        {
            return character != null && captureModes.TryGetValue(character.Id, out bool enabled) && enabled;
        }

        /// <summary>
        /// Toggles capture mode. Kept as a dedicated API so a later UI button
        /// can replace the chat command without changing fight logic.
        /// </summary>
        public void SetCaptureMode(Character character, bool enabled)
        {
            if (character == null)
            {
                return;
            }

            captureModes[character.Id] = enabled;
            character.Reply(enabled ? CaptureModeOnMessage : CaptureModeOffMessage);
        }

        public bool IsCaptureNet(CharacterItemRecord item)
        {
            return item != null && PokefusCaptureNetRecord.GetByItemGid(item.GId) != null;
        }

        public CharacterItemRecord? GetEquippedCaptureNet(Character character)
        {
            return character?.Inventory.GetEquipedItem(CaptureNetPosition);
        }

        public bool IsPokefusItem(CharacterItemRecord item)
        {
            return item != null && item.Effects.Exists<EffectPokefus>();
        }

        public IEnumerable<CharacterItemRecord> GetPokefusItems(Inventory inventory)
        {
            return inventory.GetEquipedItems()
                .Where(x => IsPokefusItem(x) && IsPokefusPosition(x.PositionEnum))
                .OrderBy(x => Array.IndexOf(PokefusPositions, x.PositionEnum));
        }

        public int GetActivePokefusCount(Character character)
        {
            return GetPokefusItems(character.Inventory).Count();
        }

        /// <summary>
        /// If the client tries to equip a pokéfus on the default companion slot (or any non-team slot),
        /// remap to the first free team slot. Returns false if equip should be blocked.
        /// </summary>
        public bool TryResolveEquipPosition(Character character, CharacterItemRecord item, ref CharacterInventoryPositionEnum position)
        {
            if (IsCaptureNet(item))
            {
                if (position == CharacterInventoryPositionEnum.INVENTORY_POSITION_NOT_EQUIPED)
                {
                    return true;
                }

                position = CaptureNetPosition;
                return true;
            }

            if (IsCaptureNetPosition(position))
            {
                character.Reply(CaptureSlotOnlyNetsMessage);
                return false;
            }

            if (!IsPokefusItem(item))
            {
                return true;
            }

            // Unequip request
            if (position == CharacterInventoryPositionEnum.INVENTORY_POSITION_NOT_EQUIPED)
            {
                return true;
            }

            // Requested a team slot
            if (IsPokefusPosition(position))
            {
                if (!CanEquipPokefusLevel(character, item))
                {
                    return false;
                }

                // Already in team: keep current slot (or allow explicit move later)
                if (item.IsEquiped() && IsPokefusPosition(item.PositionEnum))
                {
                    position = item.PositionEnum;
                    return true;
                }

                var requested = position;
                var occupant = character.Inventory.GetEquipedItems()
                    .FirstOrDefault(x => x.PositionEnum == requested && x.UId != item.UId);

                // Slot free → use it
                if (occupant == null)
                {
                    return true;
                }

                // Slot taken by another pokéfus → prefer a free team slot (add instead of replace)
                if (IsPokefusItem(occupant))
                {
                    var alternate = GetFreePokefusPosition(character, item.UId);
                    if (alternate == null)
                    {
                        character.Reply(string.Format(PokefusTeamFullMessage, MaxActivePokefus));
                        return false;
                    }
                    position = alternate.Value;
                    return true;
                }

                character.Reply("Ce slot est occupé par un autre objet.");
                return false;
            }

            // Client sent companion slot or wrong position → auto free team slot
            if (!CanEquipPokefusLevel(character, item))
            {
                return false;
            }

            if (item.IsEquiped() && IsPokefusPosition(item.PositionEnum))
            {
                // Already in team, ignore bad re-equip
                position = item.PositionEnum;
                return true;
            }

            var free = GetFreePokefusPosition(character, item.UId);
            if (free == null)
            {
                character.Reply(string.Format(PokefusTeamFullMessage, MaxActivePokefus));
                return false;
            }

            position = free.Value;
            return true;
        }

        public CharacterInventoryPositionEnum? GetFreePokefusPosition(Character character, int? ignoreUid = null)
        {
            var occupied = character.Inventory.GetEquipedItems()
                .Where(x => IsPokefusPosition(x.PositionEnum) && (!ignoreUid.HasValue || x.UId != ignoreUid.Value))
                .Select(x => x.PositionEnum)
                .ToHashSet();

            foreach (var slot in PokefusPositions)
            {
                if (!occupied.Contains(slot))
                {
                    return slot;
                }
            }

            return null;
        }

        private bool CanEquipPokefusLevel(Character character, CharacterItemRecord item)
        {
            EffectPokefus effect = item.Effects.GetFirst<EffectPokefus>();
            if (effect == null)
            {
                return true;
            }

            var monster = MonsterRecord.GetMonsterRecord(effect.MonsterId);
            if (monster == null)
            {
                return false;
            }

            var monsterGrade = monster.GetGrade(effect.GradeId);
            short required = monsterGrade.Level;
            if (required > 200)
            {
                required = 200;
            }

            if (required > character.Level)
            {
                character.Reply(string.Format(PokefusLevelRequirementMessage, required));
                return false;
            }

            return true;
        }

        public void OnPlayerResultApplied(FightPlayerResult result)
        {
            if (result.Fight.Winners == result.Fighter.Team)
            {
                if (result.ExperienceData != null)
                {
                    var activeItems = GetPokefusItems(result.Character.Inventory).ToList();
                    AddPokefusExperience(result.Character, result.ExperienceData.ExperienceFightDelta);
                    PokefusGenomeService.Instance.AddGeneticExperience(
                        result.Character,
                        activeItems,
                        result.ExperienceData.ExperienceFightDelta);
                }

            }
        }

        public bool AddPokefusExperience(Character character, long experienceDelta)
        {
            var items = GetPokefusItems(character.Inventory).ToList();

            if (items.Count == 0)
            {
                return false;
            }

            var delta = GuildBuildingEffectApi.ApplyGain(
                character,
                "POKEFUS_XP_PERCENT",
                experienceDelta / items.Count);

            foreach (var item in items)
            {
                EffectPokefus effect = item.Effects.GetFirst<EffectPokefus>();
                EffectPokefusLevel effectLevel = item.Effects.GetFirst<EffectPokefusLevel>();

                var level = effectLevel.Level;
                effectLevel.AddExperience(delta);

                if (level != effectLevel.Level)
                {
                    character.Reply(string.Format(PokefusLevelUpMessage, effect.MonsterName, effectLevel.Level));
                }

                character.Inventory.OnItemModified(item);
                item.UpdateLater();
                PokefusGenomeService.Instance.SyncItem(character, item);
            }

            return true;
        }

        public void OnFighterJoined(Fighter fighter)
        {
            if (!(fighter is CharacterFighter))
                return;

            CharacterFighter characterFighter = (CharacterFighter)fighter;

            foreach (var pokefusItem in GetPokefusItems(characterFighter.Character.Inventory))
            {
                AddFighter(characterFighter, pokefusItem);
            }
        }

        private void AddFighter(CharacterFighter owner, CharacterItemRecord pokefusItem)
        {
            EffectPokefus effect = pokefusItem.Effects.GetFirst<EffectPokefus>();
            MonsterRecord monsterRecord = MonsterRecord.GetMonsterRecord(effect.MonsterId);

            CellRecord cell = owner.Team.GetPlacementCell();
            if (cell == null)
            {
                owner.Fight.Warn($"Plus de cellule de placement pour le pokéfus {effect.MonsterName}.");
                return;
            }

            PokefusFighter pokefusFighter = new PokefusFighter(owner, pokefusItem, monsterRecord, null, effect.GradeId, cell);
            owner.Team.AddFighter(pokefusFighter);
        }

        private void RemoveFighter(CharacterFighter owner, CharacterItemRecord pokefusItem)
        {
            var pokefusFighter = owner.Team.GetFighters<PokefusFighter>().FirstOrDefault(x => x.PokefusItem == pokefusItem);

            if (pokefusFighter != null)
            {
                owner.Team.RemoveFighter(pokefusFighter);
            }
            else
            {
                owner.Fight.Warn("Impossible de retirer le pokéfus du combat. Le combattant est introuvable.");
            }
        }

        public CharacterItemRecord CreatePokefusItem(long characterId, ItemRecord itemRecord, MonsterRecord monster, byte monsterGradeId, bool legendary = false)
        {
            CharacterItemRecord item = ItemsManager.Instance.CreateCharacterItem(itemRecord, characterId, 1);

            item.Effects.Clear();

            item.Effects.Add(new EffectPokefus((short)monster.Id, monster.Name, monsterGradeId));
            item.Effects.Add(new EffectPokefusLevel(0));
            item.Effects.Add(new EffectInteger(EffectsEnum.Effect_Followed, (int)monster.Id));

            return item;
        }

        public bool OnSpellCasting(SpellCast arg)
        {
            if (!(arg.Source is PokefusFighter))
            {
                return true;
            }

            bool result = true;

            if (arg.Spell.Level.Effects.Any(x => ForbiddenPokefusSpellEffects.Contains(x.EffectEnum)))
            {
                result = false;
            }

            foreach (var effect in arg.Spell.Level.Effects)
            {
                var dice = ((EffectDice)effect);

                if (effect.EffectEnum == EffectsEnum.Effect_AddState)
                {
                    SpellStateRecord state = SpellStateRecord.GetSpellStateRecord(dice.Value);

                    if (state.Id == 218 || state.Invulnerable)
                    {
                        result = false;
                    }
                }

                if (effect.EffectEnum == EffectsEnum.Effect_SubAP || effect.EffectEnum == EffectsEnum.Effect_RemoveAP || effect.EffectEnum == EffectsEnum.Effect_SubAP_Roll)
                {
                    if (dice.Max > 4 || dice.Min > 4)
                    {
                        result = false;
                    }
                }
                if (effect.EffectEnum == EffectsEnum.Effect_SkipTurn || effect.EffectEnum == EffectsEnum.Effect_EndTurn)
                {
                    result = false;
                }

                if (effect.EffectEnum == EffectsEnum.Effect_SubResistances || effect.EffectEnum == EffectsEnum.Effect_SubEarthResistPercent ||
                    effect.EffectEnum == EffectsEnum.Effect_SubWaterResistPercent || effect.EffectEnum == EffectsEnum.Effect_SubAirResistPercent
                    || effect.EffectEnum == EffectsEnum.Effect_SubFireResistPercent)
                {
                    if (dice.Max > 50 || dice.Min > 50)
                    {
                        result = false;
                    }
                }
                if (effect.EffectEnum == EffectsEnum.Effect_DamageEarth || effect.EffectEnum == EffectsEnum.Effect_DamageAir ||
                    effect.EffectEnum == EffectsEnum.Effect_DamageFire || effect.EffectEnum == EffectsEnum.Effect_DamageWater ||
                    effect.EffectEnum == EffectsEnum.Effect_DamageNeutral)
                {
                    if (dice.Min > 150 || dice.Max > 150)
                    {
                        result = false;
                    }
                }
                if (effect.EffectEnum == EffectsEnum.Effect_Summon && dice.Min == 2941)
                {
                    result = false;
                }
            }

            if (ForbiddenPokefusSpells.Contains(arg.SpellId))
            {
                result = false;
            }

            if (!result)
            {
                arg.Source.Fight.Warn(string.Format(CannotCastMessage, arg.Spell.Record.Name));
            }

            return result;
        }

        public bool CanEquipItem(Character character, CharacterItemRecord item)
        {
            if (!IsPokefusItem(item))
            {
                return true;
            }

            return CanEquipPokefusLevel(character, item);
        }

        public void OnItemEquipped(Character owner, CharacterItemRecord item)
        {
            PokefusGenomeService.Instance.SyncItem(owner, item);
            if (IsCaptureNet(item) && IsCaptureNetPosition(item.PositionEnum))
            {
                owner.Reply($"<b>{item.Record.Name}</b> équipé dans le slot Filet (x{item.Quantity}).");
            }
            if (owner.Fighting && !owner.Fighter.Fight.Started && IsPokefusItem(item) && IsPokefusPosition(item.PositionEnum))
            {
                AddFighter(owner.Fighter, item);
            }
        }

        /// <summary>
        /// A click/use on a net equips the whole stack. It must never be consumed.
        /// </summary>
        public bool OnItemUse(Character character, CharacterItemRecord item)
        {
            if (!IsCaptureNet(item))
            {
                return false;
            }

            if (IsCaptureNetPosition(item.PositionEnum))
            {
                character.Reply($"<b>{item.Record.Name}</b> est déjà équipé (x{item.Quantity}).");
                return true;
            }

            character.Inventory.SetItemPosition(item.UId, CaptureNetPosition, item.Quantity);
            return true;
        }

        public void OnItemUnequipped(Character owner, CharacterItemRecord item)
        {
            PokefusGenomeService.Instance.SyncItem(owner, item);
            if (owner.Fighting && !owner.Fighter.Fight.Started && IsPokefusItem(item))
            {
                RemoveFighter(owner.Fighter, item);
            }
        }

        public void OnHumanOptionsCreated(Character character)
        {
            PokefusGenomeService.Instance.EnsureCharacterState(character);
        }

        /// <summary>
        /// Intercepts a resolved player action before animation, AP cost and
        /// damage. Returning false cancels the original attack after a success.
        /// </summary>
        public bool OnDirectAttackExecuting(SpellCastHandler handler)
        {
            if (handler?.Cast == null)
            {
                return true;
            }

            SpellCast cast = handler.Cast;
            if (cast.GetParent() != null || cast.Force || cast.Token != null || cast.MarkSource != null)
            {
                return true;
            }

            if (cast.Source is not CharacterFighter characterFighter)
            {
                return true;
            }

            Character character = characterFighter.Character;
            if (!IsCaptureModeEnabled(character) || !characterFighter.IsFighterTurn || !characterFighter.Alive)
            {
                return true;
            }

            if (cast.Target is not MonsterFighter monster ||
                !monster.Alive ||
                monster.Team != characterFighter.EnemyTeam ||
                monster.PokefusStatus == PokefusStatusEnum.NONE)
            {
                return true;
            }

            return !TryCaptureFromDirectAttack(character, monster);
        }

        /// <summary>
        /// Legacy item-use path. Capture is now triggered by an equipped net
        /// plus capture mode; using the item itself no longer captures.
        /// </summary>
        public bool TryCaptureMonster(Character character, CharacterItemRecord item, short targetCellId)
        {
            if (!IsCaptureNet(item))
            {
                return false;
            }

            character.Reply("Équipe un filet dans l'emplacement dédié et active le mode capture (.capture on).");
            return true;
        }

        private bool TryCaptureFromDirectAttack(Character character, MonsterFighter monster)
        {
            CharacterItemRecord? netItem = GetEquippedCaptureNet(character);
            if (netItem == null || netItem.Quantity < 1)
            {
                character.Reply(NoNetMessage);
                return false;
            }

            PokefusCaptureNetRecord? net = PokefusCaptureNetRecord.GetByItemGid(netItem.GId);
            if (net == null)
            {
                character.Reply(NoNetMessage);
                return false;
            }

            if (monster.Level < net.MinMonsterLevel || monster.Level > net.MaxMonsterLevel)
            {
                character.Reply(string.Format(NetRangeMessage, net.MinMonsterLevel, net.MaxMonsterLevel));
                return false;
            }

            PokefusSpeciesRecord? species = PokefusSpeciesRecord.GetSpeciesByMonster(monster.Record.Id);
            if (species == null || !species.Enabled || !species.CaptureEnabled)
            {
                character.Reply("Cette espèce n'est pas disponible à la capture.");
                return false;
            }

            ItemRecord? template = monster.IsLegendaryPokefus
                ? PokefusWishManager.GetTemplateForRarity(PokefusRarity.Legendary)
                : PokefusWishManager.GetTemplateForRarity(PokefusRarity.Common);
            if (template == null)
            {
                Logger.Write("[Pokéfus][CAPTURE] no configured Pokéfus item template is available.", Channels.Warning);
                character.Reply("La capture est impossible : aucun objet Pokéfus n'est configuré.");
                return false;
            }

            if (!character.Inventory.ConsumeQuantity(netItem, 1))
            {
                character.Reply(NoNetMessage);
                return false;
            }

            double captureRate = Math.Clamp(PokefusCaptureConfigurationRecord.Current.CaptureRate, 0d, 1d);
            if (Random.Shared.NextDouble() >= captureRate)
            {
                character.Reply(CaptureFailMessage);
                Logger.Write(
                    $"[Pokéfus][CAPTURE] failed character={character.Id} monster={monster.Record.Id} status={monster.PokefusStatus}",
                    Channels.Info);
                return false;
            }

            CharacterItemRecord capturedItem = CreatePokefusItem(
                character.Id,
                template,
                monster.Record,
                monster.Grade.GradeId,
                monster.IsLegendaryPokefus);
            character.Inventory.AddItem(capturedItem);
            long pokefusId = PokefusGenomeService.Instance.EnsureInstance(character, capturedItem, monster.IsLegendaryPokefus);
            if (pokefusId == 0)
            {
                character.Inventory.RemoveItem(capturedItem.UId, capturedItem.Quantity);
                Logger.Write(
                    $"[Pokéfus][CAPTURE] persistence failed character={character.Id} species={species.Id} monster={monster.Record.Id} item={capturedItem.UId}",
                    Channels.Critical);
                character.Reply("La capture n'a pas pu être enregistrée. Le monstre reste capturable.");
                return false;
            }

            if (monster.Fight is FightPvM pvm)
            {
                pvm.Challenges.InvalidateAll();
            }

            monster.RemoveFromFightAlive();

            character.Reply(monster.IsLegendaryPokefus
                ? string.Format(CaptureSuccessLegendaryMessage, monster.Record.Name)
                : string.Format(CaptureSuccessMessage, monster.Record.Name));
            GameplayEventApi.PokefusCaptured(
                character,
                monster.IsLegendaryPokefus ? "LEGENDARY" : "COMMON");
            PokefusGenomeService.Instance.SendState(character);
            Logger.Write(
                $"[Pokéfus][CAPTURE] success character={character.Id} pokefus={pokefusId} species={species.Id} monster={monster.Record.Id} status={monster.PokefusStatus} item={capturedItem.UId}",
                Channels.Info);
            return true;
        }

        public void ReplyTeamStatus(Character character)
        {
            var team = GetPokefusItems(character.Inventory).ToList();
            character.Reply($"<b>Équipe Pokéfus</b> : {team.Count}/{MaxActivePokefus}");

            int i = 1;
            foreach (var item in team)
            {
                var pf = item.Effects.GetFirst<EffectPokefus>();
                var lvl = item.Effects.GetFirst<EffectPokefusLevel>();
                character.Reply($"  [{i}] {pf.MonsterName} — niv. {lvl.Level} (UID {item.UId}, slot {(int)item.PositionEnum})");
                i++;
            }

            if (team.Count == 0)
            {
                character.Reply("Aucun pokéfus actif. Utilise l'interface Pokéfus ou double-clique un Signe dans l'inventaire.");
            }
        }

        public bool ActivatePokefus(Character character, int objectUid)
        {
            var item = character.Inventory.GetItem(objectUid);
            if (item == null || !IsPokefusItem(item))
            {
                character.Reply("Pokéfus introuvable.");
                return false;
            }

            if (item.IsEquiped() && IsPokefusPosition(item.PositionEnum))
            {
                character.Reply("Ce pokéfus est déjà dans l'équipe.");
                return true;
            }

            var free = GetFreePokefusPosition(character);
            if (free == null)
            {
                character.Reply(string.Format(PokefusTeamFullMessage, MaxActivePokefus));
                return false;
            }

            if (!CanEquipPokefusLevel(character, item))
            {
                return false;
            }

            character.Inventory.SetItemPosition(item.UId, free.Value, 1);
            var pf = item.Effects.GetFirst<EffectPokefus>();
            character.Reply($"<b>{pf.MonsterName}</b> a rejoint l'équipe ({GetActivePokefusCount(character)}/{MaxActivePokefus}).");
            return true;
        }

        public bool DeactivatePokefus(Character character, int objectUid)
        {
            var item = character.Inventory.GetItem(objectUid);
            if (item == null || !IsPokefusItem(item))
            {
                character.Reply("Pokéfus introuvable.");
                return false;
            }

            if (!item.IsEquiped() || !IsPokefusPosition(item.PositionEnum))
            {
                character.Reply("Ce pokéfus n'est pas dans l'équipe.");
                return false;
            }

            character.Inventory.SetItemPosition(item.UId, CharacterInventoryPositionEnum.INVENTORY_POSITION_NOT_EQUIPED, 1);
            var pf = item.Effects.GetFirst<EffectPokefus>();
            character.Reply($"<b>{pf.MonsterName}</b> a quitté l'équipe.");
            return true;
        }
    }
}
