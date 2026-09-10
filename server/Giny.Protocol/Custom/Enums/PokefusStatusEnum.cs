namespace Giny.Protocol.Custom.Enums
{
    /// <summary>
    /// Authoritative status of one monster instance in a roleplay group.
    /// Zero deliberately means that the monster is an ordinary, non-capturable monster.
    /// </summary>
    public enum PokefusStatusEnum : byte
    {
        NONE = 0,
        POKEFUS_NORMAL = 1,
        POKEFUS_LEGENDARY = 2,
    }
}
