<?php

namespace App\Services;

class RoomRepository
{
    /**
     * @return array{slug: string, name: string, email: string, bookingPath: string, displayPath: string}|null
     */
    public function getRoomBySlug(string $slug): ?array
    {
        $rooms = config('rooms.rooms', []);
        $room = $rooms[$slug] ?? null;
        if (!$room) {
            return null;
        }
        return [
            'slug' => $room['slug'],
            'name' => $room['name'],
            'email' => $room['email'],
            'bookingPath' => $room['booking_path'],
            'displayPath' => $room['display_path'],
        ];
    }

    /** @return string[] */
    public function getRoomSlugs(): array
    {
        $rooms = config('rooms.rooms', []);
        return array_keys($rooms);
    }
}
