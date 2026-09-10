using System;

namespace Giny.World.Managers.Modern
{
    /// <summary>Revision cache with bounded reconciliation for legacy mutations lacking notifications.
    /// The owning WorldClient serializes access under its modern send lock.</summary>
    public sealed class ModernSnapshotCache
    {
        private object owner;
        private long revision;
        private long refreshedAt;
        private string json;
        public string Read(object currentOwner, long currentRevision, Func<string> build, bool force, long now)
        {
            if (force || json == null || !ReferenceEquals(owner, currentOwner) || revision != currentRevision || now - refreshedAt >= 30000)
            {
                // Publish only a successful build; an exception must remain retryable.
                var next = build();
                owner = currentOwner;
                revision = currentRevision;
                refreshedAt = now;
                json = next;
            }
            return json;
        }
    }
}
