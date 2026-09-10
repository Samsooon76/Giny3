using System;
using Giny.World.Managers.Monsters;

namespace Giny.World.Api
{
    /// <summary>
    /// Extension point for modules that enrich a generated group before it is
    /// exposed to players. The group is still created by World, so modules do not
    /// become a second source of truth for map spawning.
    /// </summary>
    public static class MonsterGroupEventApi
    {
        public static event Action<MonsterGroup>? OnGenerated;

        internal static void Generated(MonsterGroup group)
        {
            OnGenerated?.Invoke(group);
        }
    }
}
