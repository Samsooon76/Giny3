using Giny.ORM.Attributes;
using Giny.ORM.Interfaces;
using Giny.ORM.IO;

namespace Giny.Pokefus.Data.Records
{
    [Table("pokefus", false)]
    public class PokefusRecord : IRecord
    {
        [Primary]
        public long Id { get; set; }

        public long CharacterId { get; set; }

        public long SpeciesId { get; set; }

        [Update]
        public int? CharacterItemUid { get; set; }

        [Update]
        public string? CustomName { get; set; }

        [Update]
        public short Level { get; set; }

        [Update]
        public long IndividualExperience { get; set; }

        public DateTime CapturedAt { get; set; }

        [Update]
        public bool IsActive { get; set; }

        /// <summary>
        /// Rarity is captured at spawn time and never recalculated from the item
        /// or from the capture roll.
        /// </summary>
        [Update]
        public bool IsLegendary { get; set; }

        public static PokefusRecord? Get(long id)
        {
            return DatabaseReader.ReadFirst<PokefusRecord>(nameof(Id), id.ToString());
        }

        public static IEnumerable<PokefusRecord> GetByCharacter(long characterId)
        {
            return DatabaseReader.Select<PokefusRecord>(nameof(CharacterId), characterId);
        }
    }

    [Table("player_pokefus_species_progress", false)]
    public class PlayerPokefusSpeciesProgressRecord : IRecord
    {
        [Primary]
        public long Id { get; set; }

        public long CharacterId { get; set; }

        public long SpeciesId { get; set; }

        [Update]
        public long TotalExperience { get; set; }

        [Update]
        public long AvailableExperience { get; set; }

        [Update]
        public DateTime UpdatedAt { get; set; }

        public static PlayerPokefusSpeciesProgressRecord? Get(long characterId, long speciesId)
        {
            return DatabaseReader.Select<PlayerPokefusSpeciesProgressRecord>(nameof(CharacterId), characterId)
                .FirstOrDefault(x => x.SpeciesId == speciesId);
        }
    }

    [Table("player_pokefus_researched_genes", false)]
    public class PlayerPokefusResearchedGeneRecord : IRecord
    {
        [Primary]
        public long Id { get; set; }

        public long CharacterId { get; set; }

        public long SpeciesId { get; set; }

        public long GeneId { get; set; }

        public DateTime ResearchedAt { get; set; }

        public static IEnumerable<PlayerPokefusResearchedGeneRecord> GetByCharacterAndSpecies(
            long characterId,
            long speciesId)
        {
            return DatabaseReader.Select<PlayerPokefusResearchedGeneRecord>(nameof(CharacterId), characterId)
                .Where(x => x.SpeciesId == speciesId);
        }
    }

    [Table("pokefus_unlocked_genes", false)]
    public class PokefusUnlockedGeneRecord : IRecord
    {
        [Primary]
        public long Id { get; set; }

        public long PokefusId { get; set; }

        public long GeneId { get; set; }

        public string PaymentMethod { get; set; } = string.Empty;

        public long PaidKamas { get; set; }

        public int PaidOgrines { get; set; }

        public DateTime UnlockedAt { get; set; }

        public static IEnumerable<PokefusUnlockedGeneRecord> GetByPokefus(long pokefusId)
        {
            return DatabaseReader.Select<PokefusUnlockedGeneRecord>(nameof(PokefusId), pokefusId);
        }
    }

    [Table("pokefus_equipped_genes", false)]
    public class PokefusEquippedGeneRecord : IRecord
    {
        [Primary]
        public long Id { get; set; }

        public long PokefusId { get; set; }

        public long GeneId { get; set; }

        public byte Slot { get; set; }

        public DateTime EquippedAt { get; set; }

        public static IEnumerable<PokefusEquippedGeneRecord> GetByPokefus(long pokefusId)
        {
            return DatabaseReader.Select<PokefusEquippedGeneRecord>(nameof(PokefusId), pokefusId)
                .OrderBy(x => x.Slot);
        }
    }
}
