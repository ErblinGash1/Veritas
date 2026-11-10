<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class AnalyzeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; 
    }

    public function rules(): array
    {
        return [
            'content' => 'required_without:url|string|min:10',
            'url'     => 'required_without:content|url',
        ];
    }

    public function messages(): array
    {
        return [
            'content.required_without' => 'Duhet të jepni tekstin e lajmit nëse nuk jepni një URL.',
            'content.min'              => 'Teksti i lajmit duhet të jetë të paktën 10 karaktere.',
            'url.required_without'     => 'Duhet të jepni një URL nëse nuk jepni tekstin e lajmit.',
            'url.url'                  => 'Format i pavlefshëm i linkut (URL).',
        ];
    }
}