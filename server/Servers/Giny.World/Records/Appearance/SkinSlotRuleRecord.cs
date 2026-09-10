using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text.Json;
using Giny.Core;
using Giny.Core.DesignPattern;
using Giny.World.Modules;

namespace Giny.World.Records.Appearance
{
    public class SkinSlotRuleRecord
    {
        private static readonly Dictionary<short, SkinSlotRuleRecord> m_records = new Dictionary<short, SkinSlotRuleRecord>();

        public short SkinId { get; set; }
        public List<SkinSlotRuleInfo> SlotRulesList { get; set; } = new List<SkinSlotRuleInfo>();

        [StartupInvoke("Skin slot rules", StartupInvokePriority.ThirdPass)]
        public static void Initialize()
        {
            m_records.Clear();
            string path = ResolveDumpPath();
            if (!File.Exists(path))
            {
                Logger.Write($"(SkinSlotRules) Dump not found at {path}", Channels.Warning);
                return;
            }

            try
            {
                using var fileStream = File.OpenRead(path);
                using var gzipStream = new GZipStream(fileStream, CompressionMode.Decompress);
                using var jsonDoc = JsonDocument.Parse(gzipStream);

                foreach (var prop in jsonDoc.RootElement.EnumerateObject())
                {
                    if (short.TryParse(prop.Name, out short skinId))
                    {
                        var record = new SkinSlotRuleRecord { SkinId = skinId };
                        if (prop.Value.TryGetProperty("slotRulesList", out var rulesListElem) &&
                            rulesListElem.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var ruleElem in rulesListElem.EnumerateArray())
                            {
                                var info = new SkinSlotRuleInfo
                                {
                                    SlotRuleType = ruleElem.TryGetProperty("slotRuleType", out var t) ? t.GetInt32() : 0,
                                    SlotRuleInfo = ruleElem.TryGetProperty("slotRuleInfo", out var i) ? i.GetInt32() : 0,
                                };

                                if (ruleElem.TryGetProperty("slotsRules", out var slotsElem) &&
                                    slotsElem.ValueKind == JsonValueKind.Array)
                                {
                                    foreach (var slotElem in slotsElem.EnumerateArray())
                                    {
                                        info.SlotsRules.Add(new SlotRuleData
                                        {
                                            Id = slotElem.TryGetProperty("id", out var sId) ? sId.GetInt32() : 0,
                                            Mask = slotElem.TryGetProperty("mask", out var m) ? m.GetInt32() : 0,
                                        });
                                    }
                                }
                                record.SlotRulesList.Add(info);
                            }
                        }
                        m_records[skinId] = record;
                    }
                }
                Logger.Write($"(SkinSlotRules) Loaded {m_records.Count} skin slot rules from dump.", Channels.Log);
            }
            catch (Exception ex)
            {
                Logger.Write($"(SkinSlotRules) Error loading dump: {ex.Message}", Channels.Warning);
            }
        }

        private static string ResolveDumpPath()
        {
            var dir = AppContext.BaseDirectory;
            for (int i = 0; i < 10 && dir != null; i++)
            {
                string candidate = Path.Combine(dir, "client", "web", "runtime-assets", "catalog", "data", "skinslotsrules.json.gz");
                if (File.Exists(candidate))
                    return candidate;
                var parent = Directory.GetParent(dir);
                if (parent == null) break;
                dir = parent.FullName;
            }
            return Path.Combine(Environment.CurrentDirectory, "client/web/runtime-assets/catalog/data/skinslotsrules.json.gz");
        }

        public static SkinSlotRuleRecord? GetRule(short skinId)
        {
            m_records.TryGetValue(skinId, out var record);
            return record;
        }

        public SkinSlotRuleInfo? GetMatchingRule(byte breedId, bool sex, short faceId)
        {
            // Priority: Face (3) > BreedAndSex (2) > Breed (1) > Default (0)
            foreach (var r in SlotRulesList)
            {
                if (r.SlotRuleType == 3 && r.SlotRuleInfo == faceId)
                    return r;
            }

            int breedAndSex = breedId * 2 + (sex ? 1 : 0);
            foreach (var r in SlotRulesList)
            {
                if (r.SlotRuleType == 2 && r.SlotRuleInfo == breedAndSex)
                    return r;
            }

            foreach (var r in SlotRulesList)
            {
                if (r.SlotRuleType == 1 && r.SlotRuleInfo == breedId)
                    return r;
            }

            foreach (var r in SlotRulesList)
            {
                if (r.SlotRuleType == 0)
                    return r;
            }

            return null;
        }

        public static bool RuleMasksSlot(short skinId, byte breedId, bool sex, short faceId, int targetSlotId)
        {
            var record = GetRule(skinId);
            if (record == null) return false;
            var match = record.GetMatchingRule(breedId, sex, faceId);
            if (match == null) return false;
            return match.SlotsRules.Any(sr => sr.Id == targetSlotId && sr.Mask != 0);
        }

        public static bool RuleMasksFace(short skinId, byte breedId, bool sex, short faceId)
        {
            // Slot 0 corresponds to head/face slot
            return RuleMasksSlot(skinId, breedId, sex, faceId, 0);
        }

        public static List<short> ComputeActiveSkins(byte breedId, bool sex, short cosmeticSkin, short baseBreedSkin, IEnumerable<short> equippedSkins)
        {
            var result = new List<short>();
            if (baseBreedSkin != 0)
                result.Add(baseBreedSkin);

            bool faceMasked = false;
            var eqList = equippedSkins.Distinct().ToList();

            foreach (var eq in eqList)
            {
                if (RuleMasksFace(eq, breedId, sex, cosmeticSkin))
                {
                    faceMasked = true;
                    break;
                }
            }

            if (cosmeticSkin != 0 && !faceMasked)
                result.Add(cosmeticSkin);

            foreach (var eq in eqList)
            {
                if (!result.Contains(eq))
                    result.Add(eq);
            }

            return result;
        }
    }

    public class SkinSlotRuleInfo
    {
        public int SlotRuleType { get; set; }
        public int SlotRuleInfo { get; set; }
        public List<SlotRuleData> SlotsRules { get; set; } = new List<SlotRuleData>();
    }

    public class SlotRuleData
    {
        public int Id { get; set; }
        public int Mask { get; set; }
    }
}
