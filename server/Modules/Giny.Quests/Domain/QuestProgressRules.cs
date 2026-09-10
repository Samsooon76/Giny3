namespace Giny.Quests.Domain
{
    public sealed record QuestProgressState(int CurrentAmount, bool Completed);

    public static class QuestProgressRules
    {
        public static QuestProgressState Advance(int currentAmount, int targetAmount, int amount, bool completed)
        {
            if (completed || amount <= 0 || targetAmount <= 0)
            {
                return new QuestProgressState(currentAmount, completed);
            }
            int next = Math.Min(targetAmount, checked(currentAmount + amount));
            return new QuestProgressState(next, next >= targetAmount);
        }

        public static bool CanClaim(bool completed, bool rewardClaimed) => completed && !rewardClaimed;
    }
}
