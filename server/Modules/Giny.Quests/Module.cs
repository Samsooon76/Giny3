using Giny.Quests.Data;
using Giny.Quests.Services;
using Giny.World.Api;
using Giny.World.Managers.Entities.Characters;
using Giny.World.Modules;
using Giny.World.Managers.Modern;

namespace Giny.Quests
{
    [Module("Daily & Weekly Quests")]
    public sealed class Module : IModule
    {
        public void Initialize()
        {
            QuestDataManager.Initialize();
            ModernModuleActions.Register("quests.sync", (_, character) => QuestStateService.Instance.SendState(character));
            ModernModuleActions.Register("quests.claim", (request, character) =>
            {
                var result = QuestRewardService.Instance.Claim(character, request.Int("questId", 1, int.MaxValue));
                if (!result.Success) throw new ArgumentException(result.Message);
            });
            ModernModuleActions.Register("battlepass.claim", (request, character) =>
            {
                int level = request.Int("level", 1, 10000);
                var result = BattlePassTrackService.Claim(character, level, request.Int("vip", 0, 1) == 1 ? "VIP" : "FREE");
                if (!result.Success) throw new ArgumentException(result.Message);
            });
            QuestResetScheduler.Instance.Start();
        }

        public void CreateHooks()
        {
            CharacterEventApi.OnHumanOptionsCreated += OnCharacterConnected;
            CharacterEventApi.OnDisconnected += character => QuestGenerationService.Instance.RemoveSession(character.Id);
            FightEventApi.OnPlayerResultApplied += QuestProgressService.Instance.OnFightResult;
            GameplayEventApi.OnResourcesHarvested += QuestProgressService.Instance.OnResourcesHarvested;
            GameplayEventApi.OnItemsCrafted += QuestProgressService.Instance.OnItemsCrafted;
            GameplayEventApi.OnPokefusCaptured += QuestProgressService.Instance.OnPokefusCaptured;
        }

        private static void OnCharacterConnected(Character character)
        {
            QuestGenerationService.Instance.EnsurePeriods(character);
            QuestStateService.Instance.SendState(character);
        }
    }
}
