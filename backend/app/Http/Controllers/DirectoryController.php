<?php

namespace App\Http\Controllers;

use App\Services\GraphService;
use Illuminate\Http\JsonResponse;

class DirectoryController extends Controller
{
    /** @var GraphService */
    private $graph;

    public function __construct(GraphService $graph)
    {
        $this->graph = $graph;
    }

    public function index(): JsonResponse
    {
        try {
            $users = $this->graph->getDirectoryUsers();
            return response()->json(['users' => $users]);
        } catch (\Throwable $e) {
            $message = $e->getMessage();
            $status = (strpos($message, '403') !== false) || (strpos($message, 'permission') !== false) ? 403 : 500;
            return response()->json([
                'error' => 'Failed to load users',
                'hint' => $message,
            ], $status);
        }
    }
}
