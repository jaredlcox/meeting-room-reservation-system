import { notFound } from "next/navigation";
import { getRoomBySlug, getRoomSlugs } from "@/lib/rooms";
import RoomKiosk from "@/components/room-kiosk";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getRoomSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const room = getRoomBySlug(slug);
  if (!room) return {};
  return {
    title: `${room.name} — Room Display`,
    description: `Meeting room display kiosk for ${room.name}`,
  };
}

export default async function RoomPage({ params }: PageProps) {
  const { slug } = await params;
  const room = getRoomBySlug(slug);
  if (!room) notFound();
  return <RoomKiosk room={room} />;
}
