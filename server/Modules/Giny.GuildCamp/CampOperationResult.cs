namespace Giny.GuildCamp
{
    public sealed record CampOperationResult(bool Success, string Message)
    {
        public static CampOperationResult Ok(string message) => new(true, message);
        public static CampOperationResult Fail(string message) => new(false, message);
    }
}
