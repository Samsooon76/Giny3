using System.Collections.Generic;
using Giny.Protocol.Enums;
using Giny.Protocol.Types;
using Giny.World.Managers.Fights;
using Giny.World.Managers.Fights.Fighters;
using Giny.World.Managers.Fights.Results;
using Giny.World.Records.Maps;
using Xunit;

namespace Giny.World.Tests;

public class CombatMapLifecycleTests
{
    private sealed class TestFight : Fight
    {
        public TestFight(MapRecord arena, MapRecord source) : base(null!, 1, arena,
            new FightTeam(TeamEnum.TEAM_DEFENDER, new CellRecord[0], AlignmentSideEnum.ALIGNMENT_WITHOUT, TeamTypeEnum.TEAM_TYPE_MONSTER),
            new FightTeam(TeamEnum.TEAM_CHALLENGER, new CellRecord[0], AlignmentSideEnum.ALIGNMENT_WITHOUT, TeamTypeEnum.TEAM_TYPE_PLAYER),
            new CellRecord(), source) { }
        public override FightTypeEnum FightType => FightTypeEnum.FIGHT_TYPE_PvM;
        public override bool ShowBlades => false;
        public override bool SpawnJoin => false;
        public override void OnFighterJoined(Fighter fighter) { }
        public override void OnFightStarted() { }
        public override void OnFightEnded() { }
        public override FightCommonInformations GetFightCommonInformations() => new();
        protected override IEnumerable<IFightResult> GenerateResults() => new IFightResult[0];
    }

    [Fact]
    public void ArenaDoesNotReplaceReturnMapAndExplicitDungeonDestinationStillWins()
    {
        var source = new MapRecord { Id = 1 }; var arena = new MapRecord { Id = 2 };
        var fight = new TestFight(arena, source);
        Assert.Same(arena, fight.Map);
        Assert.Same(source, fight.RoleplayMap);
        Assert.Equal(1, fight.ReturnMapId);
        fight.TargetMapId = 3;
        Assert.Equal(3, fight.ReturnMapId);
    }
}
