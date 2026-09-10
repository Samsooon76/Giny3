using Giny.Protocol.Enums;
using Giny.World.Managers.Entities.Characters;
using Giny.World.Records.Items;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Giny.World.Api
{
    public class InventoryEventApi
    {
        /*
         * bool = can equip ?
         * This return value is not a good option .. (multiple event binding)
         */
        public delegate bool OnEquipItemDelegate(Character character, CharacterItemRecord item);

        public static event OnEquipItemDelegate CanEquipItem;

        /// <summary>
        /// Optional remap of equip position (e.g. pokéfus team slots). Return false to cancel.
        /// </summary>
        public delegate bool ResolveEquipPositionDelegate(Character character, CharacterItemRecord item, ref CharacterInventoryPositionEnum position);

        public static event ResolveEquipPositionDelegate ResolveEquipPosition;

        public delegate void ItemMovedDelegate(Character owner, CharacterItemRecord item);

        public static event ItemMovedDelegate OnItemEquipped;

        public static event ItemMovedDelegate OnItemUnequipped;

        /// <summary>
        /// Gives optional gameplay modules a chance to handle an item targeted at
        /// a fight cell. Returning true means the item use was handled; the module
        /// owns validation and consumption so a failed capture can still consume
        /// exactly one compatible net while an invalid request consumes nothing.
        /// </summary>
        public delegate bool ItemUseInFightDelegate(Character character, CharacterItemRecord item, short targetCellId);

        public static event ItemUseInFightDelegate? OnItemUseInFight;

        /// <summary>
        /// Out-of-fight item use. Returning true means the module handled the
        /// click and the default consume-one path must not run.
        /// </summary>
        public static event Func<Character, CharacterItemRecord, bool>? OnItemUse;

        internal static void ItemEquipped(Character owner, CharacterItemRecord item)
        {
            OnItemEquipped?.Invoke(owner, item);
        }
        internal static void ItemUnequipped(Character owner, CharacterItemRecord item)
        {
            OnItemUnequipped?.Invoke(owner, item);
        }
        internal static bool OnItemEquipping(Character character, CharacterItemRecord item)
        {
            if (CanEquipItem != null)
            {
                return CanEquipItem.Invoke(character, item);
            }
            else
            {
                return true;
            }
        }

        internal static bool OnResolveEquipPosition(Character character, CharacterItemRecord item, ref CharacterInventoryPositionEnum position)
        {
            if (ResolveEquipPosition != null)
            {
                return ResolveEquipPosition.Invoke(character, item, ref position);
            }
            return true;
        }

        internal static bool TryUseItemInFight(Character character, CharacterItemRecord item, short targetCellId)
        {
            return OnItemUseInFight?.Invoke(character, item, targetCellId) == true;
        }

        internal static bool TryUseItem(Character character, CharacterItemRecord item)
        {
            return OnItemUse?.Invoke(character, item) == true;
        }
    }
}
