using Giny.Protocol.Custom.Enums;
using Giny.Quests.Data;
using Giny.Quests.Domain;
using Giny.Quests.Services;
using Giny.World.Managers.Chat;
using Giny.World.Network;

namespace Giny.Quests
{
    internal static class ChatCommands
    {
        [ChatCommand("quests", ServerRoleEnum.Player)]
        public static void List(WorldClient client)
        {
            QuestSession session = QuestGenerationService.Instance.EnsurePeriods(client.Character);
            foreach (PlayerQuest quest in session.Quests
                         .Where(x => (x.Period == QuestPeriods.Daily && x.PeriodKey == session.Daily.Key) ||
                                     (x.Period == QuestPeriods.Weekly && x.PeriodKey == session.Weekly.Key))
                         .OrderBy(x => x.Period).ThenBy(x => x.SlotNumber))
            {
                string state = quest.RewardClaimed ? "✓ récupérée" : quest.Completed ? "terminée" : $"{quest.CurrentAmount}/{quest.TargetAmount}";
                client.Character.Reply($"<b>#{quest.Id} {quest.Title}</b> — {state}");
            }
            QuestStateService.Instance.SendState(client.Character, session);
        }

        [ChatCommand("qstate", ServerRoleEnum.Player)]
        public static void State(WorldClient client) => QuestStateService.Instance.SendState(client.Character);

        [ChatCommand("qclaim", ServerRoleEnum.Player)]
        public static void Claim(WorldClient client, long questId)
        {
            QuestClaimResult result = QuestRewardService.Instance.Claim(client.Character, questId);
            if (!result.Success) client.Character.ReplyWarning(result.Message);
        }

        [ChatCommand("qreset", ServerRoleEnum.Administrator)]
        public static void Reset(WorldClient client, string period)
        {
            string normalized = period.ToUpperInvariant();
            if (normalized != QuestPeriods.Daily && normalized != QuestPeriods.Weekly)
            {
                client.Character.ReplyWarning("Usage : .qreset daily|weekly");
                return;
            }
            QuestGenerationService.Instance.ForceReset(client.Character, normalized);
            QuestStateService.Instance.SendState(client.Character, operation: "RESET");
            client.Character.Reply($"Quêtes {normalized} régénérées.");
        }

        [ChatCommand("qcomplete", ServerRoleEnum.Administrator)]
        public static void Complete(WorldClient client, long questId)
        {
            QuestSession session = QuestGenerationService.Instance.EnsurePeriods(client.Character);
            PlayerQuest? quest = session.Quests.FirstOrDefault(x => x.Id == questId);
            bool success = quest != null && QuestProgressService.Instance.AddAdminProgress(client.Character, questId, quest.TargetAmount);
            client.Character.Reply(success ? $"Quête #{questId} complétée." : "Quête introuvable.");
        }

        [ChatCommand("qprogress", ServerRoleEnum.Administrator)]
        public static void Progress(WorldClient client, long questId, int amount)
        {
            bool success = QuestProgressService.Instance.AddAdminProgress(client.Character, questId, amount);
            client.Character.Reply(success ? $"Progression +{amount} sur #{questId}." : "Quête ou quantité invalide.");
        }

        [ChatCommand("qgenerate", ServerRoleEnum.Administrator)]
        public static void Generate(WorldClient client)
        {
            QuestGenerationService.Instance.Reload(client.Character);
            QuestStateService.Instance.SendState(client.Character, operation: "GENERATE");
            client.Character.Reply("Génération des quêtes vérifiée.");
        }

        [ChatCommand("qreload", ServerRoleEnum.Administrator)]
        public static void Reload(WorldClient client)
        {
            QuestDataManager.Reload();
            QuestGenerationService.Instance.Reload(client.Character);
            client.Character.Reply("Templates et récompenses de quêtes rechargés.");
        }

        [ChatCommand("bpclaim", ServerRoleEnum.Player)]
        public static void BattlePassClaim(WorldClient client, int level, string track)
        {
            QuestClaimResult result = BattlePassTrackService.Claim(client.Character, level, track);
            if (!result.Success) client.Character.ReplyWarning(result.Message);
        }

        [ChatCommand("bpvip", ServerRoleEnum.Administrator)]
        public static void BattlePassVip(WorldClient client, string state)
        {
            bool enabled = state.Equals("on", StringComparison.OrdinalIgnoreCase) ||
                           state.Equals("1", StringComparison.OrdinalIgnoreCase) ||
                           state.Equals("true", StringComparison.OrdinalIgnoreCase);
            if (!enabled &&
                !state.Equals("off", StringComparison.OrdinalIgnoreCase) &&
                !state.Equals("0", StringComparison.OrdinalIgnoreCase) &&
                !state.Equals("false", StringComparison.OrdinalIgnoreCase))
            {
                client.Character.ReplyWarning("Usage : .bpvip on|off");
                return;
            }

            BattlePassTrackService.SetVip(client.Character, enabled);
            client.Character.Reply(enabled ? "Passe VIP Battle Pass activé." : "Passe VIP Battle Pass retiré.");
        }
    }
}
