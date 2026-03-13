<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\MicrosoftGraphService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DirectoryUsersController extends Controller
{
    public function __construct(
        private MicrosoftGraphService $graph
    ) {}

    public function index(Request $request): JsonResponse
    {
        try {
            $users = $this->graph->getDirectoryUsers();
            return response()->json(['users' => $users]);
        } catch (\Throwable $e) {
            \Log::error('[directory/users] ' . $e->getMessage());
            $message = $e->getMessage();
            $status = (str_contains($message, '403') || str_contains($message, 'permission')) ? 403 : 500;
            return response()->json([
                'error' => 'Failed to load users',
                'hint' => $message,
            ], $status);
        }
    }
}
