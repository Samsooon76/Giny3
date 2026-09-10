using System;
using System.Collections.Generic;
using System.Linq;
using Giny.Core.IO;
using Giny.World.Catalog;
using Giny.World.Managers.Effects;
using Giny.World.Managers.Fights.Zones;
using Giny.World.Records.Monsters;
using Giny.World.Records.Spells;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Giny.World.Tests;

public class OfficialCatalogTests
{
    static OfficialRecordAdapter Adapter() => new(new JObject(), JObject.Parse(@"{
        'ItemData':{'usable':{'mask':1},'exchangeable':{'mask':4},'isSaleable':{'mask':1024}},
        'EffectInstanceData':{'trigger':{'mask':32},'forClientOnly':{'mask':16}}
    }"));

    [Fact]
    public void FlagsAndCriteriaAreExpandedWithoutChangingRawData()
    {
        var raw=JObject.Parse("{'m_flags':1028,'criterions':'PL>20'}");
        var result=Adapter().Expand(raw,"Weapon");
        Assert.False((bool)result["usable"]!);Assert.True((bool)result["exchangeable"]!);
        Assert.True((bool)result["isSaleable"]!);Assert.Equal("PL>20",(string?)result["criteria"]);
        Assert.Null(raw["criteria"]);
    }

    [Fact]
    public void EffectsSurviveTheActualGinyProtobufSerializer()
    {
        var effects=Adapter().ConvertEffects(JArray.Parse(@"[{'effectId':97,'diceNum':12,'diceSide':18,'value':0,
            'm_flags':32,'targetMask':'a,A','triggers':'TB','duration':3,
            'zoneDescr':{'shape':67,'param1':3,'param2':1,'damageDecreaseStepPercent':0,
            'maxDamageDecreaseApplyCount':2,'includeCarried':1}},
            {'effectId':9999,'value':4,'m_flags':16}]"));
        var restored=Protobuf.Deserialize<EffectCollection>(Protobuf.Serialize(effects));
        var dice=Assert.IsType<EffectDice>(Assert.Single(restored));
        Assert.Equal(12,dice.Min);Assert.Equal(18,dice.Max);Assert.Equal(3,dice.Duration);
        Assert.True(dice.IncludeCarried);Assert.True(dice.Trigger);
        Assert.Equal("C3,1,0,2,0",dice.RawZone);
        Assert.True(((EffectDice)dice.Clone()).IncludeCarried);
    }

    [Fact]
    public void MonsterGradeMapsStatsAndDodgesWithoutTruncation()
    {
        var grade=(MonsterGrade)Adapter().ConvertToken(JObject.Parse(@"{'grade':3,'level':45,'lifePoints':1234,
            'actionPoints':9,'movementPoints':4,'paDodge':27,'pmDodge':28,'fireResistance':-20,
            'bonusCharacteristics':{'lifePoints':7}}"),typeof(MonsterGrade));
        var read=Protobuf.Deserialize<List<MonsterGrade>>(Protobuf.Serialize(new List<MonsterGrade>{grade}))[0];
        Assert.Equal(3,read.GradeId);Assert.Equal(1234,read.LifePoints);Assert.Equal(27,read.ApDodge);
        Assert.Equal(28,read.MpDodge);Assert.Equal(-20,read.FireResistance);
    }

    [Fact]
    public void ProtocolOverflowIsRejectedInsteadOfWrapping()
    {
        Assert.ThrowsAny<Exception>(()=>Adapter().ConvertToken(new JValue(34590),typeof(short)));
        Assert.ThrowsAny<Exception>(()=>Adapter().ConvertToken(new JValue(2),typeof(bool)));
        Assert.ThrowsAny<Exception>(()=>Adapter().ConvertToken(new JValue(""),typeof(Giny.World.Managers.Entities.Look.ServerEntityLook)));
    }

    [Fact]
    public void UnsupportedEffectIsDetectedBeforeExecution()
    {
        var level=new SpellLevelRecord{Effects=new EffectCollection(new[]{new EffectDice(32760,1,2,0){RawTriggers="I",TargetMask="a,A",RawZone="P0"}}),CriticalEffects=new EffectCollection()};
        var reasons=CatalogMigration.SpellReasons(level,JObject.Parse("{'effects':[],'criticalEffect':[],'m_flags':0}"));
        Assert.Contains("Unsupported effect 32760",reasons);
    }
}
