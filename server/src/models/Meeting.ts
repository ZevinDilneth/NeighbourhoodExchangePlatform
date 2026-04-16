import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IMeeting extends Document {
  roomId:           string;              // e.g. "NEX-AB12CD3"
  exchangeId?:      Types.ObjectId;      // linked exchange (optional)
  creatorId:        Types.ObjectId;      // user who created the room
  title:            string;              // display title
  status:           'pending' | 'active' | 'ended';
  createdAt:        Date;
  startedAt?:       Date;
  endedAt?:         Date;
  recordingDir?:    string;              // absolute path on server
  recordingFiles:   string[];            // MP4 filenames
  chatExportPath?:  string;              // path to chat.json
  participants:     Types.ObjectId[];    // users who joined
}

const MeetingSchema = new Schema<IMeeting>(
  {
    roomId:          { type: String, required: true, unique: true, index: true },
    exchangeId:      { type: Schema.Types.ObjectId, ref: 'Exchange' },
    creatorId:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title:           { type: String, default: '' },
    status:          { type: String, enum: ['pending', 'active', 'ended'], default: 'pending' },
    startedAt:       { type: Date },
    endedAt:         { type: Date },
    recordingDir:    { type: String },
    recordingFiles:  { type: [String], default: [] },
    chatExportPath:  { type: String },
    participants:    { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
  },
  { timestamps: true },
);

export default mongoose.model<IMeeting>('Meeting', MeetingSchema);
