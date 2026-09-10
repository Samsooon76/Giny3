using System.Text.Json;

namespace Giny.World.Managers.Modern
{
    public sealed record ModernActionRequest(string RequestId, long CharacterId, string Action, JsonElement Args)
    {
        public static ModernActionRequest Parse(string json)
        {
            if (json.Length > 4096) throw new ArgumentException("Commande trop longue.");
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.GetProperty("schemaVersion").GetInt32() != 1) throw new ArgumentException("Version de commande incompatible.");
            string id = root.GetProperty("requestId").GetString() ?? "";
            if (!Guid.TryParse(id, out _)) throw new ArgumentException("Identifiant de commande invalide.");
            if (!long.TryParse(root.GetProperty("characterId").GetString(), out long characterId) || characterId <= 0)
                throw new ArgumentException("Personnage invalide.");
            string action = root.GetProperty("action").GetString() ?? "";
            if (action.Length is < 1 or > 48) throw new ArgumentException("Action invalide.");
            var args = root.GetProperty("args");
            if (args.ValueKind != JsonValueKind.Object) throw new ArgumentException("Paramètres invalides.");
            return new ModernActionRequest(id, characterId, action, args.Clone());
        }

        public int Int(string name, int min, int max)
        {
            if (!Args.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.Number || !value.TryGetInt32(out int number) || number < min || number > max)
                throw new ArgumentException($"Paramètre {name} invalide.");
            return number;
        }
    }
}
