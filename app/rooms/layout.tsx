import { KioskScrollLock } from "@/components/kiosk/scroll-lock";

export default function RoomsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <KioskScrollLock />
      <div className="kiosk-viewport overflow-hidden flex flex-col">
        {children}
      </div>
    </>
  );
}
