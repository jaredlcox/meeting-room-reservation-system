import { notFound } from "next/navigation";
import { getRoomBySlug, getRoomSlugs } from "@/lib/rooms";
import { BookingForm } from "@/components/book/booking-form";

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
    title: `Book — ${room.name}`,
    description: `Reserve ${room.name}`,
  };
}

export default async function BookPage({ params }: PageProps) {
  const { slug } = await params;
  const room = getRoomBySlug(slug);
  if (!room) notFound();
  return <BookingForm room={room} />;
}
