using Giny.Protocol.Custom.Enums;
using Giny.World.Records.Items;

namespace Giny.World.Managers.Items
{
    public static class ModernEquipmentRules
    {
        public static int[] Positions(ItemTypeEnum type, bool usable, bool weapon) => type switch
        {
            ItemTypeEnum.AMULET => new[] { 0 },
            ItemTypeEnum.RING => new[] { 2, 4 },
            ItemTypeEnum.BELT => new[] { 3 },
            ItemTypeEnum.BOOTS => new[] { 5 },
            ItemTypeEnum.HAT => new[] { 6 },
            ItemTypeEnum.CLOAK => new[] { 7 },
            ItemTypeEnum.PET or ItemTypeEnum.PETSMOUNT => new[] { 8 },
            ItemTypeEnum.DOFUS or ItemTypeEnum.TROPHY => new[] { 9, 10, 11, 12, 13, 14 },
            ItemTypeEnum.SHIELD => new[] { 15 },
            ItemTypeEnum.COSTUME => new[] { 30 },
            _ when weapon => new[] { 1 },
            _ when usable => new[] { 31 },
            _ => Array.Empty<int>(),
        };

        public static int[] Positions(ItemRecord item) => Positions(item.TypeEnum, item.Usable, WeaponRecord.GetWeapon(item.Id) != null);
    }
}
