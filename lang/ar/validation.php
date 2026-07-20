<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| رسائل التحقق من المدخلات
|--------------------------------------------------------------------------
| الرسائل القياسية + أسماء الحقول العربية في مصفوفة attributes.
| الـ Form Requests لا تحمل messages() — تعتمد على هذا الملف بالكامل.
*/

return [

    'accepted' => 'يجب قبول :attribute.',
    'active_url' => ':attribute ليس رابطاً صحيحاً.',
    'after' => ':attribute يجب أن يكون تاريخاً بعد :date.',
    'after_or_equal' => ':attribute يجب أن يكون تاريخاً بعد أو يساوي :date.',
    'alpha' => ':attribute يجب أن يحتوي على حروف فقط.',
    'alpha_dash' => ':attribute يجب أن يحتوي على حروف وأرقام وشرطات فقط.',
    'alpha_num' => ':attribute يجب أن يحتوي على حروف وأرقام فقط.',
    'array' => ':attribute يجب أن يكون مصفوفة.',
    'before' => ':attribute يجب أن يكون تاريخاً قبل :date.',
    'before_or_equal' => ':attribute يجب أن يكون تاريخاً قبل أو يساوي :date.',
    'between' => [
        'numeric' => ':attribute يجب أن يكون بين :min و :max.',
        'file' => ':attribute يجب أن يكون بين :min و :max كيلوبايت.',
        'string' => ':attribute يجب أن يكون بين :min و :max حرفاً.',
        'array' => ':attribute يجب أن يحتوي بين :min و :max عنصراً.',
    ],
    'boolean' => 'حقل :attribute يجب أن يكون صحيحاً أو خطأً.',
    'confirmed' => 'تأكيد :attribute غير متطابق.',
    'date' => ':attribute ليس تاريخاً صحيحاً.',
    'date_equals' => ':attribute يجب أن يساوي التاريخ :date.',
    'date_format' => ':attribute لا يطابق الصيغة :format.',
    'different' => ':attribute و :other يجب أن يكونا مختلفين.',
    'digits' => ':attribute يجب أن يكون :digits رقماً.',
    'digits_between' => ':attribute يجب أن يكون بين :min و :max رقماً.',
    'email' => ':attribute يجب أن يكون بريداً إلكترونياً صحيحاً.',
    'ends_with' => ':attribute يجب أن ينتهي بأحد القيم التالية: :values.',
    'exists' => ':attribute المحدد غير موجود.',
    'file' => ':attribute يجب أن يكون ملفاً.',
    'filled' => 'حقل :attribute مطلوب.',
    'gt' => [
        'numeric' => ':attribute يجب أن يكون أكبر من :value.',
        'file' => ':attribute يجب أن يكون أكبر من :value كيلوبايت.',
        'string' => ':attribute يجب أن يكون أكبر من :value حرفاً.',
        'array' => ':attribute يجب أن يحتوي أكثر من :value عنصراً.',
    ],
    'gte' => [
        'numeric' => ':attribute يجب أن يكون :value أو أكبر.',
        'file' => ':attribute يجب أن يكون :value كيلوبايت أو أكبر.',
        'string' => ':attribute يجب أن يكون :value حرفاً أو أكثر.',
        'array' => ':attribute يجب أن يحتوي :value عنصراً أو أكثر.',
    ],
    'image' => ':attribute يجب أن يكون صورة.',
    'in' => ':attribute المحدد غير صحيح.',
    'integer' => ':attribute يجب أن يكون عدداً صحيحاً.',
    'ip' => ':attribute يجب أن يكون عنوان IP صحيحاً.',
    'ipv4' => ':attribute يجب أن يكون عنوان IPv4 صحيحاً.',
    'ipv6' => ':attribute يجب أن يكون عنوان IPv6 صحيحاً.',
    'json' => ':attribute يجب أن يكون نص JSON صحيحاً.',
    'lt' => [
        'numeric' => ':attribute يجب أن يكون أصغر من :value.',
        'file' => ':attribute يجب أن يكون أصغر من :value كيلوبايت.',
        'string' => ':attribute يجب أن يكون أصغر من :value حرفاً.',
        'array' => ':attribute يجب أن يحتوي أقل من :value عنصراً.',
    ],
    'lte' => [
        'numeric' => ':attribute يجب أن يكون :value أو أصغر.',
        'file' => ':attribute يجب أن يكون :value كيلوبايت أو أصغر.',
        'string' => ':attribute يجب أن يكون :value حرفاً أو أقل.',
        'array' => ':attribute يجب ألا يحتوي أكثر من :value عنصراً.',
    ],
    'max' => [
        'numeric' => ':attribute يجب ألا يكون أكبر من :max.',
        'file' => ':attribute يجب ألا يكون أكبر من :max كيلوبايت.',
        'string' => ':attribute يجب ألا يكون أكبر من :max حرفاً.',
        'array' => ':attribute يجب ألا يحتوي أكثر من :max عنصراً.',
    ],
    'mimes' => ':attribute يجب أن يكون ملفاً من نوع: :values.',
    'mimetypes' => ':attribute يجب أن يكون ملفاً من نوع: :values.',
    'min' => [
        'numeric' => ':attribute يجب أن يكون :min على الأقل.',
        'file' => ':attribute يجب أن يكون :min كيلوبايت على الأقل.',
        'string' => ':attribute يجب أن يكون :min أحرف على الأقل.',
        'array' => ':attribute يجب أن يحتوي :min عناصر على الأقل.',
    ],
    'not_in' => ':attribute المحدد غير صحيح.',
    'not_regex' => 'صيغة :attribute غير صحيحة.',
    'numeric' => ':attribute يجب أن يكون رقماً.',
    'present' => 'حقل :attribute يجب أن يكون موجوداً.',
    'prohibited_if' => 'حقل :attribute ممنوع عندما يكون :other هو :value.',
    'regex' => 'صيغة :attribute غير صحيحة.',
    'required' => 'حقل :attribute مطلوب.',
    'required_if' => 'حقل :attribute مطلوب عندما يكون :other هو :value.',
    'required_unless' => 'حقل :attribute مطلوب إلا إذا كان :other ضمن :values.',
    'required_with' => 'حقل :attribute مطلوب عند وجود :values.',
    'required_with_all' => 'حقل :attribute مطلوب عند وجود :values.',
    'required_without' => 'حقل :attribute مطلوب عند عدم وجود :values.',
    'required_without_all' => 'حقل :attribute مطلوب عند عدم وجود أيٍّ من :values.',
    'same' => ':attribute و :other يجب أن يتطابقا.',
    'size' => [
        'numeric' => ':attribute يجب أن يساوي :size.',
        'file' => ':attribute يجب أن يكون :size كيلوبايت.',
        'string' => ':attribute يجب أن يكون :size حرفاً.',
        'array' => ':attribute يجب أن يحتوي :size عنصراً.',
    ],
    'starts_with' => ':attribute يجب أن يبدأ بأحد القيم التالية: :values.',
    'string' => ':attribute يجب أن يكون نصاً.',
    'timezone' => ':attribute يجب أن يكون منطقة زمنية صحيحة.',
    'unique' => ':attribute مستخدَم مسبقاً.',
    'uploaded' => 'فشل رفع :attribute.',
    'url' => 'صيغة :attribute غير صحيحة.',
    'uuid' => ':attribute يجب أن يكون UUID صحيحاً.',

    /*
    |--------------------------------------------------------------------------
    | أسماء الحقول بالعربية
    |--------------------------------------------------------------------------
    */

    'attributes' => [
        'name' => 'الاسم',
        'email' => 'البريد الإلكتروني',
        'password' => 'كلمة المرور',
        'password_confirmation' => 'تأكيد كلمة المرور',
        'token' => 'رمز إعادة التعيين',
        'status' => 'الحالة',
        'roles' => 'الأدوار',
        'roles.*' => 'الدور',
        'role' => 'الدور',
        'display_name' => 'الاسم المعروض',
        'description' => 'الوصف',
        'permissions' => 'الصلاحيات',
        'permissions.*' => 'الصلاحية',
        'slug' => 'المعرّف',
        'icon' => 'الأيقونة',
        'sort_order' => 'الترتيب',
        'avatar' => 'الصورة الرمزية',
        'bio' => 'النبذة',
        'social_links' => 'روابط التواصل',
        'note' => 'الملاحظة',
        'is_writer' => 'كاتب',
        'current_password' => 'كلمة المرور الحالية',
        'sportmonks_api_key' => 'مفتاح SportMonks',
        'sportmonks_base_url' => 'رابط SportMonks',
        'openweather_api_key' => 'مفتاح OpenWeather',
        'openweather_base_url' => 'رابط OpenWeather',
        'openweather_units' => 'وحدة القياس',
        'openweather_default_language' => 'اللغة الافتراضية',
    ],
];
