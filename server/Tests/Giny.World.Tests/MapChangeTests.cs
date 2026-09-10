using System.Linq;
using Giny.Protocol.Custom.Enums;
using Giny.World.Managers.Maps;
using Giny.World.Records.Maps;
using Xunit;

namespace Giny.World.Tests
{
    public class MapChangeTests
    {
        [Theory]
        [InlineData(MapScrollEnum.TOP, 0, 532)]
        [InlineData(MapScrollEnum.BOTTOM, 532, 0)]
        [InlineData(MapScrollEnum.LEFT, 0, 27)]
        [InlineData(MapScrollEnum.RIGHT, 27, 0)]
        public void KeepsWalkableArrivalInEveryDirection(MapScrollEnum direction, short source, short target)
        {
            var map = CreateMap();
            map.Cells[target].LosMov = 0;

            Assert.Equal((short?)target, MapsManager.Instance.FindMapChangeCell(map, direction, source));
        }

        [Theory]
        [InlineData(1)] // Blocked terrain.
        [InlineData(4)] // Walkable terrain, forbidden during roleplay.
        [InlineData(128)] // Farm cell.
        public void RejectsBlockedDirectArrivalAndBlockedBorderCells(int blockedFlags)
        {
            var map = CreateMap();
            map.Cells[532].LosMov = blockedFlags;
            map.Cells[533].LosMov = blockedFlags;
            map.Cells[534].LosMov = 0;
            map.BottomChange.AddRange(new[] { map.Cells[532], map.Cells[533], map.Cells[534] });
            map.Cells[0].LosMov = 0; // A valid cell away from the arrival border.

            Assert.Equal((short?)534, MapsManager.Instance.FindMapChangeCell(map, MapScrollEnum.TOP, 0));
        }

        [Fact]
        public void UsesNearestWalkableCellWhenEntireArrivalBorderIsBlocked()
        {
            var map = CreateMap();
            map.BottomChange.Add(map.Cells[532]);
            map.Cells[533].LosMov = 0;
            map.Cells[0].LosMov = 0;

            Assert.Equal((short?)533, MapsManager.Instance.FindMapChangeCell(map, MapScrollEnum.TOP, 0));
        }

        [Theory]
        [InlineData(MapScrollEnum.TOP, 28)] // Offset gives exactly 560.
        [InlineData(MapScrollEnum.TOP, 559)]
        [InlineData(MapScrollEnum.BOTTOM, 0)]
        public void HandlesOutOfBoundsArrival(MapScrollEnum direction, short source)
        {
            var map = CreateMap();
            map.Cells[300].LosMov = 0;

            Assert.Equal((short?)300, MapsManager.Instance.FindMapChangeCell(map, direction, source));
        }

        [Theory]
        [InlineData(1)]
        [InlineData(4)]
        [InlineData(128)]
        public void ReturnsNoArrivalWhenMapHasNoRoleplayDestination(int flags)
        {
            var map = CreateMap();
            foreach (var cell in map.Cells)
                cell.LosMov = flags;
            map.BottomChange.Add(map.Cells[532]);

            Assert.Null(MapsManager.Instance.FindMapChangeCell(map, MapScrollEnum.TOP, 0));
        }

        [Theory]
        [InlineData(-1)]
        [InlineData(560)]
        [InlineData(561)]
        public void OutOfBoundsCellsAreNotWalkable(short cellId)
        {
            Assert.False(CreateMap().IsCellWalkable(cellId));
        }

        private static MapRecord CreateMap()
        {
            return new MapRecord
            {
                Cells = Enumerable.Range(0, (int)MapPoint.MapSize)
                    .Select(id => new CellRecord { Id = (short)id, LosMov = 1 }).ToArray(),
                TopChange = new(),
                BottomChange = new(),
                LeftChange = new(),
                RightChange = new(),
            };
        }
    }
}
