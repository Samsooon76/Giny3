namespace Giny.World.Managers.Modern;

public static class NpcTransactionRules
{
    public static bool TryPrice(double unitPrice, int quantity, bool selling, out int price)
    {
        price = 0;
        if (!double.IsFinite(unitPrice) || unitPrice < 1 || quantity <= 0) return false;
        double total = Math.Floor((selling ? unitPrice / 10 : unitPrice) * quantity);
        if (selling) total = Math.Max(1, total);
        if (!double.IsFinite(total) || total < 1 || total > int.MaxValue) return false;
        price = (int)total; return true;
    }
    public static int TradeQuantity(long quantity, double rate)
    {
        if (quantity < 0 || !double.IsFinite(rate) || rate <= 0) throw new ArgumentException("Quantité ou taux invalide.");
        decimal total;
        try { total = decimal.Floor(quantity * (decimal)rate); }
        catch (OverflowException) { throw new ArgumentException("Quantité échangée trop importante."); }
        if (total > int.MaxValue) throw new ArgumentException("Quantité échangée trop importante.");
        return (int)total;
    }
}
