using System;
using System.Runtime.Serialization;
using Giny.World.Managers.Exchanges.Trades;
using Giny.World.Managers.Modern;
using Giny.World.Records.Npcs;
using Xunit;

namespace Giny.World.Tests;
public class NpcInteractionTests
{
    [Theory]
    [InlineData(10, 0)]
    [InlineData(10, -1)]
    [InlineData(10, int.MaxValue)]
    [InlineData(double.NaN, 1)]
    [InlineData(double.PositiveInfinity, 1)]
    [InlineData(-1, 1)]
    public void InvalidPurchaseNeverProducesACost(double unit, int quantity) => Assert.False(NpcTransactionRules.TryPrice(unit, quantity, false, out _));
    [Theory]
    [InlineData(15, 3, false, 45)]
    [InlineData(15, 3, true, 4)]
    [InlineData(1, 1, true, 1)]
    [InlineData(1, int.MaxValue, false, int.MaxValue)]
    public void PricesMatchTheServerRounding(double unit, int quantity, bool selling, int expected)
    {
        Assert.True(NpcTransactionRules.TryPrice(unit, quantity, selling, out var cost)); Assert.Equal(expected, cost);
    }
    [Fact]
    public void FractionalTradesRoundTheWholeOfferAndAllowZeroPreview()
    {
        Assert.Equal(0, NpcTransactionRules.TradeQuantity(1, .5));
        Assert.Equal(1, NpcTransactionRules.TradeQuantity(2, .5));
        Assert.Equal(50, NpcTransactionRules.TradeQuantity(1, 50));
        Assert.Equal(29, NpcTransactionRules.TradeQuantity(100, .29));
        Assert.Throws<ArgumentException>(() => NpcTransactionRules.TradeQuantity(int.MaxValue, 50));
    }
    [Theory]
    [InlineData("0")]
    [InlineData("-1")]
    [InlineData("NaN")]
    [InlineData("Infinity")]
    [InlineData("0,5")]
    public void MalformedTradeRulesAreRejectedBeforeOpening(string rate) => Assert.Throws<ArgumentException>(() => TradeRule.Build(new NpcActionRecord { Param1 = "1:2", Param2 = rate }));
    [Fact]
    public void UnreadyAndStaleLegacyStepsCannotTouchAnInventory()
    {
        var trade = (NpcTradeExchange)FormatterServices.GetUninitializedObject(typeof(NpcTradeExchange));
        trade.Ready(false, 0); trade.Ready(true, 1);
        // No initialized inventory exists: touching it would throw.
    }
}
