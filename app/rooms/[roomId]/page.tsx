export const runtime = 'edge';

import { RoomShell } from "@/components/RoomShell";

type Props = {
  params: {
    roomId: string;
  };
};

export default function RoomPage({ params }: Props) {
  return <RoomShell roomId={params.roomId} />;
}