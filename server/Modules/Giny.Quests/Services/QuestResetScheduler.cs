using Giny.Core;
using Giny.Core.DesignPattern;
using Giny.World.Network;

namespace Giny.Quests.Services
{
    internal sealed class QuestResetScheduler : Singleton<QuestResetScheduler>, IDisposable
    {
        private Timer? timer;

        public void Start()
        {
            timer ??= new Timer(_ => Tick(), null, TimeSpan.FromSeconds(5), TimeSpan.FromSeconds(30));
        }

        private static void Tick()
        {
            try
            {
                foreach (WorldClient client in WorldServer.Instance.GetOnlineClients())
                {
                    if (client.Character == null) continue;
                    QuestSession after = QuestGenerationService.Instance.EnsurePeriods(client.Character, DateTimeOffset.UtcNow, out bool changed);
                    if (changed)
                    {
                        QuestStateService.Instance.SendState(client.Character, after, "RESET");
                        client.Character.DisplayNotification("Nouvelles quêtes récurrentes disponibles.");
                    }
                }
            }
            catch (Exception exception)
            {
                Logger.Write($"Recurring quest reset scheduler failed: {exception}", Channels.Warning);
            }
        }

        public void Dispose()
        {
            timer?.Dispose();
            timer = null;
        }
    }
}
