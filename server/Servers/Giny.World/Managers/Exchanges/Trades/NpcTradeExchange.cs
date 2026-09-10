using System.Globalization;
using Giny.Protocol.Custom.Enums;
using Giny.Protocol.Enums;
using Giny.Protocol.Messages;
using Giny.World.Managers.Entities.Characters;
using Giny.World.Managers.Entities.Npcs;
using Giny.World.Managers.Items;
using Giny.World.Managers.Modern;
using Giny.World.Records.Items;
using Giny.World.Records.Npcs;

namespace Giny.World.Managers.Exchanges.Trades;

public class TradeRule
{
    public double Rate { get; set; }
    public Dictionary<ItemRecord, ItemRecord> Items { get; set; } = new();
    public static TradeRule Build(NpcActionRecord action)
    {
        if (!double.TryParse(action.Param2, NumberStyles.Float, CultureInfo.InvariantCulture, out var rate) || !double.IsFinite(rate) || rate <= 0)
            throw new ArgumentException("Taux d’échange invalide.");
        var rule = new TradeRule { Rate = rate };
        foreach (var pair in action.Param1.Split(','))
        {
            var ids = pair.Split(':');
            if (ids.Length != 2 || !short.TryParse(ids[0], out var input) || !short.TryParse(ids[1], out var output)) throw new ArgumentException("Règle d’échange invalide.");
            var from = ItemRecord.GetItem(input) ?? throw new ArgumentException("Objet entrant inconnu.");
            var to = ItemRecord.GetItem(output) ?? throw new ArgumentException("Objet sortant inconnu.");
            rule.Items.Add(from, to);
        }
        return rule;
    }
}

public class NpcTradeExchange : TradeExchange
{
    public override ExchangeTypeEnum ExchangeType => ExchangeTypeEnum.NPC_TRADE;
    public Npc Npc { get; }
    private readonly TradeRule rule;
    private readonly Dictionary<int, CharacterItemRecord> offered = new();
    private List<CharacterItemRecord> rewards = new();
    public int[] AcceptedGids => rule.Items.Keys.Select(i => (int)i.Id).ToArray();
    public NpcTradeExchange(Character character, Npc npc, NpcActionRecord action) : base(character) { Npc = npc; rule = TradeRule.Build(action); }
    public bool CanMove(int uid, int quantity)
    {
        if (quantity == 0 || quantity == int.MinValue || !ReferenceEquals(Character.Dialog, this)) return false;
        offered.TryGetValue(uid, out var current);
        if (quantity < 0) return current != null && current.Quantity >= -(long)quantity;
        var item = Character.Inventory.GetItem(uid);
        return item != null && !item.IsEquiped() && item.CanBeExchanged() && rule.Items.ContainsKey(item.Record)
            && (long)(current?.Quantity ?? 0) + quantity <= item.Quantity;
    }
    public override void MoveItem(int uid, int quantity)
    {
        if (!CanMove(uid, quantity)) return;
        offered.TryGetValue(uid, out var previous);
        int next = (previous?.Quantity ?? 0) + quantity;
        var proposed = offered.ToDictionary(p => p.Key, p => p.Value);
        if (next == 0) proposed.Remove(uid);
        else
        {
            var clone = (CharacterItemRecord)(previous ?? Character.Inventory.GetItem(uid)).CloneWithUID();
            clone.Quantity = next; proposed[uid] = clone;
        }
        // Round the whole offer, never individual clicks; prepare before changing it.
        var newRewards = BuildRewards(proposed.Values);
        offered.Clear(); foreach (var pair in proposed) offered.Add(pair.Key, pair.Value);
        if (next == 0) Character.Client.Send(new ExchangeObjectRemovedMessage(uid, false));
        else if (previous == null) Character.Client.Send(new ExchangeObjectAddedMessage(offered[uid].GetObjectItem(), false));
        else Character.Client.Send(new ExchangeObjectModifiedMessage(offered[uid].GetObjectItem(), false));
        foreach (var old in rewards) Character.Client.Send(new ExchangeObjectRemovedMessage(old.UId, true));
        rewards = newRewards;
        foreach (var reward in rewards) Character.Client.Send(new ExchangeObjectAddedMessage(reward.GetObjectItem(), true));
    }
    private List<CharacterItemRecord> BuildRewards(IEnumerable<CharacterItemRecord> input)
    {
        var result = new List<CharacterItemRecord>();
        foreach (var group in input.GroupBy(i => rule.Items[i.Record]))
        {
            int quantity = NpcTransactionRules.TradeQuantity(group.Sum(i => (long)i.Quantity), rule.Rate);
            if (quantity > 0) {
                var preview = ItemsManager.Instance.CreateCharacterItem(group.Key, -1, quantity);
                preview.UId = result.Count + 1; // Remote preview identity; Inventory assigns the real UID on commit.
                result.Add(preview);
            }
        }
        return result;
    }
    public bool CanComplete() => ReferenceEquals(Character.Dialog, this) && offered.Count > 0 && rewards.Count > 0
        && offered.Values.All(i => {
            var actual = Character.Inventory.GetItem(i.UId);
            return actual != null && !actual.IsEquiped() && actual.CanBeExchanged() && actual.GId == i.GId && actual.Quantity >= i.Quantity;
        }) && offered.Values.GroupBy(i => rule.Items[i.Record]).All(g => NpcTransactionRules.TradeQuantity(g.Sum(i => (long)i.Quantity), rule.Rate) > 0);
    public override void Ready(bool ready, short step)
    {
        if (!ready || step != 0 || !CanComplete()) return;
        // Validate every debit before the first inventory mutation.
        var debits = offered.Values.ToArray(); var credits = rewards.ToArray();
        offered.Clear(); rewards.Clear(); // A second validation cannot commit twice.
        foreach (var debit in debits) Character.Inventory.RemoveItem(debit.UId, debit.Quantity);
        foreach (var credit in credits) { credit.CharacterId = Character.Id; Character.Inventory.AddItem(credit); }
        Succes = true; Close();
    }
    public override void Open() => Character.Client.Send(new ExchangeStartOkNpcTradeMessage(Npc.Id));
    public override IEnumerable<CharacterItemRecord> GetItems() => offered.Values.Concat(rewards).ToArray();
    public override void MoveKamas(long quantity) => Character.ReplyWarning("Ce PNJ échange uniquement des objets.");
    public override void OnNpcGenericAction(NpcActionsEnum action) => Character.ReplyWarning("Terminez l’échange en cours.");
    public override void MoveItemPriced(int objectUID, int quantity, long price) => Character.ReplyWarning("Prix non modifiable pour cet échange.");
    public override void ModifyItemPriced(int objectUID, int quantity, long price) => Character.ReplyWarning("Prix non modifiable pour cet échange.");
}
