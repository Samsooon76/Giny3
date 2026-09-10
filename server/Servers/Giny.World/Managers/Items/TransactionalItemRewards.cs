using Giny.ORM.IO;
using Giny.World.Records.Items;
using MySql.Data.MySqlClient;

namespace Giny.World.Managers.Items
{
    public static class TransactionalItemRewards
    {
        /// <summary>Prepare independent stacks, persist them with the claim, publish only after commit.</summary>
        public static CharacterItemRecord[] Insert(long characterId, IEnumerable<(int ItemId, int Quantity)> rewards,
            MySqlConnection connection, MySqlTransaction transaction)
        {
            var items = rewards.Select(reward =>
            {
                if (reward.Quantity <= 0) throw new InvalidDataException("Reward quantity must be positive.");
                var template = ItemRecord.GetItem(reward.ItemId)
                    ?? throw new InvalidDataException($"Unknown reward item {reward.ItemId}.");
                // CreateCharacterItem still casts catalogue IDs to short.
                if (template.Id <= 0 || template.Id > short.MaxValue)
                    throw new InvalidDataException($"Reward item {template.Id} is outside the supported ID range.");
                var item = ItemsManager.Instance.CreateCharacterItem(template, characterId, reward.Quantity);
                item.OnCreated();
                item.UId = ItemsManager.Instance.PopItemUID();
                return item;
            }).ToArray();
            DatabaseWriter.InsertTransactional(items, connection, transaction);
            return items;
        }
    }
}
