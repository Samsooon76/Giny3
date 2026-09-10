using Giny.GuildCamp.Data;
using Giny.World.Api;
using Giny.World.Modules;

namespace Giny.GuildCamp
{
    [Module("Campement de guilde")]
    public sealed class Module : IModule
    {
        public void Initialize()
        {
            GuildCampDataManager.Initialize();
        }

        public void CreateHooks()
        {
            GuildBuildingEffectApi.ResolvePercent += GuildCampService.Instance.ResolvePercent;
        }
    }
}
