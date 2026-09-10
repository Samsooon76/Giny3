using System.Collections.Generic;
using Giny.Core.Network.Messages;
using Giny.Protocol.Types;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;
using Version = Giny.Protocol.Types.Version;

namespace Giny.Protocol.Messages
{
    public class GuildSummaryRequestMessage : PaginationRequestAbstractMessage
    {
        public new const ushort Id = 1163;
        public override ushort MessageId => Id;

        public string nameFilter;
        public bool hideFullFilter;
        public bool followingGuildCriteria;
        public int[] criterionFilter;
        public int[] languagesFilter;
        public byte[] recruitmentTypeFilter;
        public short minLevelFilter;
        public short maxLevelFilter;
        public short minPlayerLevelFilter;
        public short maxPlayerLevelFilter;
        public int minSuccessFilter;
        public int maxSuccessFilter;
        public byte sortType;
        public bool sortDescending;

        public GuildSummaryRequestMessage()
        {
        }
        public GuildSummaryRequestMessage(string nameFilter, bool hideFullFilter, bool followingGuildCriteria, int[] criterionFilter, int[] languagesFilter, byte[] recruitmentTypeFilter, short minLevelFilter, short maxLevelFilter, short minPlayerLevelFilter, short maxPlayerLevelFilter, int minSuccessFilter, int maxSuccessFilter, byte sortType, bool sortDescending, double offset, uint count)
        {
            this.nameFilter = nameFilter;
            this.hideFullFilter = hideFullFilter;
            this.followingGuildCriteria = followingGuildCriteria;
            this.criterionFilter = criterionFilter;
            this.languagesFilter = languagesFilter;
            this.recruitmentTypeFilter = recruitmentTypeFilter;
            this.minLevelFilter = minLevelFilter;
            this.maxLevelFilter = maxLevelFilter;
            this.minPlayerLevelFilter = minPlayerLevelFilter;
            this.maxPlayerLevelFilter = maxPlayerLevelFilter;
            this.minSuccessFilter = minSuccessFilter;
            this.maxSuccessFilter = maxSuccessFilter;
            this.sortType = sortType;
            this.sortDescending = sortDescending;
            this.offset = offset;
            this.count = count;
        }
        public override void Serialize(IDataWriter writer)
        {
            base.Serialize(writer);
            byte _box0 = 0;
            _box0 = BooleanByteWrapper.SetFlag(_box0, 0, hideFullFilter);
            _box0 = BooleanByteWrapper.SetFlag(_box0, 1, followingGuildCriteria);
            _box0 = BooleanByteWrapper.SetFlag(_box0, 2, sortDescending);
            writer.WriteByte((byte)_box0);
            writer.WriteUTF((string)nameFilter);
            writer.WriteShort((short)criterionFilter.Length);
            for (uint _i4 = 0; _i4 < criterionFilter.Length; _i4++)
            {
                if (criterionFilter[_i4] < 0)
                {
                    throw new System.Exception("Forbidden value (" + criterionFilter[_i4] + ") on element 4 (starting at 1) of criterionFilter.");
                }

                writer.WriteVarInt((int)criterionFilter[_i4]);
            }

            writer.WriteShort((short)languagesFilter.Length);
            for (uint _i5 = 0; _i5 < languagesFilter.Length; _i5++)
            {
                if (languagesFilter[_i5] < 0)
                {
                    throw new System.Exception("Forbidden value (" + languagesFilter[_i5] + ") on element 5 (starting at 1) of languagesFilter.");
                }

                writer.WriteVarInt((int)languagesFilter[_i5]);
            }

            writer.WriteShort((short)recruitmentTypeFilter.Length);
            for (uint _i6 = 0; _i6 < recruitmentTypeFilter.Length; _i6++)
            {
                writer.WriteByte((byte)recruitmentTypeFilter[_i6]);
            }

            if (minLevelFilter < 0)
            {
                throw new System.Exception("Forbidden value (" + minLevelFilter + ") on element minLevelFilter.");
            }

            writer.WriteShort((short)minLevelFilter);
            if (maxLevelFilter < 0)
            {
                throw new System.Exception("Forbidden value (" + maxLevelFilter + ") on element maxLevelFilter.");
            }

            writer.WriteShort((short)maxLevelFilter);
            if (minPlayerLevelFilter < 0)
            {
                throw new System.Exception("Forbidden value (" + minPlayerLevelFilter + ") on element minPlayerLevelFilter.");
            }

            writer.WriteShort((short)minPlayerLevelFilter);
            if (maxPlayerLevelFilter < 0)
            {
                throw new System.Exception("Forbidden value (" + maxPlayerLevelFilter + ") on element maxPlayerLevelFilter.");
            }

            writer.WriteShort((short)maxPlayerLevelFilter);
            if (minSuccessFilter < 0)
            {
                throw new System.Exception("Forbidden value (" + minSuccessFilter + ") on element minSuccessFilter.");
            }

            writer.WriteVarInt((int)minSuccessFilter);
            if (maxSuccessFilter < 0)
            {
                throw new System.Exception("Forbidden value (" + maxSuccessFilter + ") on element maxSuccessFilter.");
            }

            writer.WriteVarInt((int)maxSuccessFilter);
            writer.WriteByte((byte)sortType);
        }
        public override void Deserialize(IDataReader reader)
        {
            uint _val4 = 0;
            uint _val5 = 0;
            uint _val6 = 0;
            base.Deserialize(reader);
            byte _box0 = (byte)(reader.ReadByte());
            hideFullFilter = BooleanByteWrapper.GetFlag(_box0, 0);
            followingGuildCriteria = BooleanByteWrapper.GetFlag(_box0, 1);
            sortDescending = BooleanByteWrapper.GetFlag(_box0, 2);
            nameFilter = (string)reader.ReadUTF();
            uint _criterionFilterLen = (uint)(reader.ReadUShort());
            criterionFilter = new int[_criterionFilterLen];
            for (uint _i4 = 0; _i4 < _criterionFilterLen; _i4++)
            {
                _val4 = (uint)reader.ReadVarUhInt();
                if (_val4 < 0)
                {
                    throw new System.Exception("Forbidden value (" + _val4 + ") on elements of criterionFilter.");
                }

                criterionFilter[_i4] = (int)_val4;
            }

            uint _languagesFilterLen = (uint)(reader.ReadUShort());
            languagesFilter = new int[_languagesFilterLen];
            for (uint _i5 = 0; _i5 < _languagesFilterLen; _i5++)
            {
                _val5 = (uint)reader.ReadVarUhInt();
                if (_val5 < 0)
                {
                    throw new System.Exception("Forbidden value (" + _val5 + ") on elements of languagesFilter.");
                }

                languagesFilter[_i5] = (int)_val5;
            }

            uint _recruitmentTypeFilterLen = (uint)(reader.ReadUShort());
            recruitmentTypeFilter = new byte[_recruitmentTypeFilterLen];
            for (uint _i6 = 0; _i6 < _recruitmentTypeFilterLen; _i6++)
            {
                _val6 = (uint)(reader.ReadByte());
                if (_val6 < 0)
                {
                    throw new System.Exception("Forbidden value (" + _val6 + ") on elements of recruitmentTypeFilter.");
                }

                recruitmentTypeFilter[_i6] = (byte)_val6;
            }

            minLevelFilter = (short)reader.ReadShort();
            if (minLevelFilter < 0)
            {
                throw new System.Exception("Forbidden value (" + minLevelFilter + ") on element of GuildSummaryRequestMessage.minLevelFilter.");
            }

            maxLevelFilter = (short)reader.ReadShort();
            if (maxLevelFilter < 0)
            {
                throw new System.Exception("Forbidden value (" + maxLevelFilter + ") on element of GuildSummaryRequestMessage.maxLevelFilter.");
            }

            minPlayerLevelFilter = (short)reader.ReadShort();
            if (minPlayerLevelFilter < 0)
            {
                throw new System.Exception("Forbidden value (" + minPlayerLevelFilter + ") on element of GuildSummaryRequestMessage.minPlayerLevelFilter.");
            }

            maxPlayerLevelFilter = (short)reader.ReadShort();
            if (maxPlayerLevelFilter < 0)
            {
                throw new System.Exception("Forbidden value (" + maxPlayerLevelFilter + ") on element of GuildSummaryRequestMessage.maxPlayerLevelFilter.");
            }

            minSuccessFilter = (int)reader.ReadVarUhInt();
            if (minSuccessFilter < 0)
            {
                throw new System.Exception("Forbidden value (" + minSuccessFilter + ") on element of GuildSummaryRequestMessage.minSuccessFilter.");
            }

            maxSuccessFilter = (int)reader.ReadVarUhInt();
            if (maxSuccessFilter < 0)
            {
                throw new System.Exception("Forbidden value (" + maxSuccessFilter + ") on element of GuildSummaryRequestMessage.maxSuccessFilter.");
            }

            sortType = (byte)reader.ReadByte();
            if (sortType < 0)
            {
                throw new System.Exception("Forbidden value (" + sortType + ") on element of GuildSummaryRequestMessage.sortType.");
            }

        }

    }
}


