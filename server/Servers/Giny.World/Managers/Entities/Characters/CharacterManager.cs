using Giny.Core;
using Giny.Core.DesignPattern;
using Giny.Core.IO.Configuration;
using Giny.ORM;
using Giny.Protocol.Custom.Enums;
using Giny.Protocol.Enums;
using Giny.Protocol.IPC.Messages;
using Giny.Protocol.Messages;
using Giny.World.Managers.Breeds;
using Giny.World.Managers.Entities.Look;
using Giny.World.Managers.Guilds;
using Giny.World.Network;
using Giny.World.Records;
using Giny.World.Records.Breeds;
using Giny.World.Records.Characters;
using Giny.World.Records.Items;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Giny.World.Managers.Entities.Characters
{
    public class CharacterManager : Singleton<CharacterManager>
    {
        public const int CharacterNameMinLength = 2;
        public const int CharacterNameMaxLength = 20;

        public CharacterCreationResult CanCreateCharacter(CharacterCreationRequestMessage message, WorldClient client)
        {
            if (WorldServer.Instance.GetServerStatus() != ServerStatusEnum.ONLINE || !IPCManager.Instance.Connected || client.InGame)
            {
                return new CharacterCreationResult(CharacterCreationResultEnum.ERR_NO_REASON);
            }
            if (!ConfigManager<WorldConfig>.Instance.AllowedBreeds.Contains((PlayableBreedEnum)message.breed))
            {
                return new CharacterCreationResult(CharacterCreationResultEnum.ERR_NOT_ALLOWED);
            }
            if (client.Characters.Count >= client.Account.CharacterSlots)
            {
                return new CharacterCreationResult(CharacterCreationResultEnum.ERR_TOO_MANY_CHARACTERS);
            }

            message.name = SanitizeCharacterName(message.name);
            NameComplianceResultEnum nameCheck = CheckCharacterName(message.name);
            if (nameCheck != NameComplianceResultEnum.NAME_OK)
            {
                Logger.Write($"Character creation refused: name='{message.name}' reason={nameCheck}", Channels.Warning);
                return new CharacterCreationResult(CharacterCreationResultEnum.ERR_INVALID_NAME, (byte)nameCheck);
            }
            if (CharacterRecord.NameExist(message.name))
            {
                return new CharacterCreationResult(CharacterCreationResultEnum.ERR_INVALID_NAME, (byte)NameComplianceResultEnum.ERROR_NAME_ALREADY_EXISTS);
            }

            return new CharacterCreationResult(CharacterCreationResultEnum.OK);
        }

        /// <summary>
        /// Dofus character names: 2-20 ASCII letters, optional hyphens (max 2),
        /// first letter capital, rest lowercase except immediately after a hyphen.
        /// Staff brackets typed by the client are stripped here and re-applied later.
        /// </summary>
        public static string SanitizeCharacterName(string name)
        {
            name = (name ?? string.Empty).Trim();
            if (name.Length >= 2 && name[0] == '[' && name[name.Length - 1] == ']')
            {
                name = name.Substring(1, name.Length - 2).Trim();
            }
            return name;
        }

        public static NameComplianceResultEnum CheckCharacterName(string name)
        {
            if (string.IsNullOrEmpty(name) || name.Length < CharacterNameMinLength || name.Length > CharacterNameMaxLength)
            {
                return NameComplianceResultEnum.ERROR_NAME_BAD_LENGTH;
            }

            int hyphenCount = 0;
            int consecutiveIdentical = 1;

            for (int i = 0; i < name.Length; i++)
            {
                char current = name[i];

                if (current == '-')
                {
                    hyphenCount++;
                    if (hyphenCount > 2 || i == 0 || i == name.Length - 1 || name[i - 1] == '-')
                    {
                        return hyphenCount > 2
                            ? NameComplianceResultEnum.ERROR_TOO_MANY_SPECIAL
                            : NameComplianceResultEnum.ERROR_INVALID_DASH_POSITION;
                    }
                    consecutiveIdentical = 1;
                    continue;
                }

                if (current >= 'À')
                {
                    return NameComplianceResultEnum.ERROR_NAME_BAD_ALPHABET;
                }

                bool isUpper = current >= 'A' && current <= 'Z';
                bool isLower = current >= 'a' && current <= 'z';
                if (!isUpper && !isLower)
                {
                    return NameComplianceResultEnum.ERROR_BAD_CHAR;
                }

                bool afterHyphen = i > 0 && name[i - 1] == '-';
                if (i == 0)
                {
                    if (!isUpper)
                    {
                        return NameComplianceResultEnum.ERROR_NAME_WITH_BAD_CASE;
                    }
                }
                else if (!afterHyphen && !isLower)
                {
                    return NameComplianceResultEnum.ERROR_NAME_WITH_BAD_CASE;
                }

                if (i > 0 && char.ToLowerInvariant(current) == char.ToLowerInvariant(name[i - 1]) && current != '-')
                {
                    consecutiveIdentical++;
                    if (consecutiveIdentical > 2)
                    {
                        return NameComplianceResultEnum.ERROR_TOO_MANY_CONSECUTIVE_IDENTICAL;
                    }
                }
                else
                {
                    consecutiveIdentical = 1;
                }
            }

            return NameComplianceResultEnum.NAME_OK;
        }
        [Annotation("constant checking")]
        public void DeleteCharacter(CharacterRecord character)
        {
            character.RemoveNow();

            CharacterItemRecord.RemoveCharacterItems(character.Id);

            if (character.GuildId != 0)
            {
                GuildsManager.Instance.OnCharacterDeleted(character);
            }
        }
        public CharacterRecord CreateCharacter(long id, string name, int accountId, byte breedId, bool sex, short cosmeticId, int[] colors)
        {
            BreedRecord breedRecord = BreedRecord.GetBreed(breedId);
            ServerEntityLook look = BreedManager.Instance.GetBreedLook(breedRecord, sex, cosmeticId, colors);
            CharacterRecord record = CharacterRecord.Create(id, name, accountId, look, breedId, cosmeticId, sex);
            Logger.Write("Character " + record.Name + " created", Channels.Log);
            return record;



        }
    }
}
