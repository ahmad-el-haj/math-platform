import { z } from 'zod'

/**
 * Form validation schemas.
 *
 * The same schemas are used by the React Hook Form resolvers and by the unit
 * tests, so the rules live in exactly one place.
 */

/* -------------------------------------------------------------------------- */
/* Authentication                                                              */
/* -------------------------------------------------------------------------- */

const emailField = z
  .email('يرجى إدخال بريد إلكتروني صحيح.')
  .max(320, 'البريد الإلكتروني طويل جدًا.')

const passwordField = z
  .string()
  .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.')
  .max(72, 'كلمة المرور طويلة جدًا.')
  .regex(/[A-Za-z]/, 'أضف حرفًا واحدًا على الأقل إلى كلمة المرور.')
  .regex(/[0-9]/, 'أضف رقمًا واحدًا على الأقل إلى كلمة المرور.')

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'يرجى إدخال كلمة المرور.').max(72, 'كلمة المرور طويلة جدًا.'),
})

export type LoginInput = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'الاسم قصير جدًا.')
      .max(120, 'الاسم طويل جدًا.'),
    email: emailField,
    password: passwordField,
    confirmPassword: z.string().min(1, 'يرجى تأكيد كلمة المرور.'),
    gradeLevel: z.string().trim().max(60, 'الصف طويل جدًا.').optional(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'كلمتا المرور غير متطابقتين.',
  })

export type RegisterInput = z.infer<typeof registerSchema>

export const forgotPasswordSchema = z.object({
  email: emailField,
})

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

export const resetPasswordSchema = z
  .object({
    password: passwordField,
    confirmPassword: z.string().min(1, 'يرجى تأكيد كلمة المرور.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'كلمتا المرور غير متطابقتين.',
  })

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

/* -------------------------------------------------------------------------- */
/* Profile                                                                     */
/* -------------------------------------------------------------------------- */

export const profileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'الاسم قصير جدًا.')
    .max(120, 'الاسم طويل جدًا.'),
  gradeLevel: z.string().trim().max(60, 'الصف طويل جدًا.'),
})

export type ProfileInput = z.infer<typeof profileSchema>

/* -------------------------------------------------------------------------- */
/* Teaching content                                                            */
/* -------------------------------------------------------------------------- */

export const classSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, 'اسم الصف يجب أن يكون حرفين على الأقل.')
    .max(120, 'اسم الصف طويل جدًا.'),
  description: z.string().trim().max(2000, 'الوصف طويل جدًا.'),
  displayOrder: z
    .number({ error: 'الترتيب يجب أن يكون رقمًا.' })
    .int('الترتيب يجب أن يكون رقمًا صحيحًا.')
    .min(0, 'الترتيب لا يمكن أن يكون سالبًا.')
    .max(9999, 'الترتيب كبير جدًا.'),
  isPublished: z.boolean(),
})

export type ClassInput = z.infer<typeof classSchema>

export const lessonSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, 'عنوان الدرس يجب أن يكون حرفين على الأقل.')
    .max(160, 'عنوان الدرس طويل جدًا.'),
  description: z.string().trim().max(4000, 'الوصف طويل جدًا.'),
  displayOrder: z
    .number({ error: 'الترتيب يجب أن يكون رقمًا.' })
    .int('الترتيب يجب أن يكون رقمًا صحيحًا.')
    .min(0, 'الترتيب لا يمكن أن يكون سالبًا.')
    .max(9999, 'الترتيب كبير جدًا.'),
  isPublished: z.boolean(),
})

export type LessonInput = z.infer<typeof lessonSchema>

export const documentSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, 'عنوان الملف يجب أن يكون حرفين على الأقل.')
    .max(160, 'عنوان الملف طويل جدًا.'),
  description: z.string().trim().max(2000, 'الوصف طويل جدًا.'),
})

export type DocumentInput = z.infer<typeof documentSchema>

/* -------------------------------------------------------------------------- */
/* Messaging                                                                   */
/* -------------------------------------------------------------------------- */

export const messageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'اكتب رسالة قبل الإرسال.')
    .max(4000, 'الرسالة طويلة جدًا (الحد 4000 حرف).'),
})

export type MessageInput = z.infer<typeof messageSchema>

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                              */
/* -------------------------------------------------------------------------- */

/** Flatten a Zod error into `{ fieldName: firstMessage }`. */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : 'form'
    if (!(key in result)) result[key] = issue.message
  }
  return result
}
