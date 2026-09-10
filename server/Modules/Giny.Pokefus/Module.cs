using Giny.Pokefus.Data;
using Giny.World.Api;
using Giny.World.Managers.Entities.Characters;
using Giny.World.Managers.Fights;
using Giny.World.Managers.Fights.Fighters;
using Giny.World.Managers.Fights.Results;
using Giny.World.Modules;
using Giny.World.Records.Items;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Giny.Pokefus
{
    [Module("Pokéfus")]
    public class Module : IModule
    {
        public void Initialize()
        {
            PokefusDataManager.Initialize();
            PokefusWishManager.Initialize();
            PokefusManager.Instance.Initialize();
        }

        public void CreateHooks()
        {
            FightEventApi.OnPlayerResultApplied += PokefusManager.Instance.OnPlayerResultApplied;
            CharacterEventApi.OnHumanOptionsCreated += PokefusManager.Instance.OnHumanOptionsCreated;
            FightEventApi.OnFighterJoined += PokefusManager.Instance.OnFighterJoined;
            InventoryEventApi.CanEquipItem += PokefusManager.Instance.CanEquipItem;
            InventoryEventApi.ResolveEquipPosition += PokefusManager.Instance.TryResolveEquipPosition;
            FightEventApi.OnSpellCasting += PokefusManager.Instance.OnSpellCasting;
            FightEventApi.OnDirectAttackExecuting += PokefusManager.Instance.OnDirectAttackExecuting;
            InventoryEventApi.OnItemEquipped += PokefusManager.Instance.OnItemEquipped;
            InventoryEventApi.OnItemUnequipped += PokefusManager.Instance.OnItemUnequipped;
            InventoryEventApi.OnItemUse += PokefusManager.Instance.OnItemUse;
            InventoryEventApi.OnItemUseInFight += PokefusManager.Instance.TryCaptureMonster;
            MonsterGroupEventApi.OnGenerated += PokefusManager.Instance.OnMonsterGroupGenerated;
        }

        public void Dispose()
        {

        }
    }
}
