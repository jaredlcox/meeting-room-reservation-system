<?php

return [
    'rooms' => [
        'canvass' => [
            'slug' => 'canvass',
            'name' => 'Canvass Room',
            'email' => env('ROOM_CANVASS_EMAIL', 'canvassroom@ircuwd.com'),
            'booking_path' => '/book/canvass',
            'display_path' => '/rooms/canvass',
        ],
        'sales' => [
            'slug' => 'sales',
            'name' => 'Sales Room',
            'email' => env('ROOM_SALES_EMAIL', 'salesroom@ircuwd.com'),
            'booking_path' => '/book/sales',
            'display_path' => '/rooms/sales',
        ],
    ],
];
