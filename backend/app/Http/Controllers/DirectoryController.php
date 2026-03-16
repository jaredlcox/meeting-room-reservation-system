<?php

namespace App\Http\Controllers;

use App\Services\GraphService;
use Illuminate\Http\JsonResponse;

class DirectoryController extends Controller
{
    public function __construct(private GraphService $graph)
    {
    }

    public function index(): JsonResponse
    {
        try {
            $users = $this->graph->getDirectoryUsers();
            return response()->json(['users' => $users]);
        } catch (\Throwable $e) {
            $message = $e->getMessage();
            $status = str_contains($message, '403') || str_contains($message, 'permission') ? 403 : 500;
            return response()->json([
                'error' => 'Failed to load users',
                'hint' => $message,
            ], $status);
        }
    }
}
