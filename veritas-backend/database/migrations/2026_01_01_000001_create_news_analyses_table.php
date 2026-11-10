<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('news_analyses', function (Blueprint $table) {
            $table->id();
            $table->longText('content');
            $table->string('prediction');                 // "REAL" ose "FAKE"
            $table->boolean('is_fake');                   // true / false
            $table->float('confidence_score');            // Confidence score %
            $table->integer('total_words')->default(0);
            $table->integer('sentences_count')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('news_analyses');
    }
};