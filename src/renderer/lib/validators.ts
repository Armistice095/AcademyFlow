import { z } from 'zod'

/** Section « Responsable légal » — au moins un responsable requis (SPEC §8). */
export const guardianSchema = z.object({
  lastName: z.string().trim().min(1, 'Le nom est requis.'),
  firstName: z.string().trim().min(1, 'Le prénom est requis.'),
  phone: z.string().trim().min(6, 'Le téléphone est requis.'),
  profession: z.string().trim().optional(),
  relationship: z.string().trim().min(1, 'Le lien de parenté est requis.')
})

/** Formulaire complet d'inscription d'un nouvel élève (F-001). */
export const studentFormSchema = z.object({
  // Identité & Scolarité
  lastName: z.string().trim().min(1, 'Le nom est requis.'),
  firstName: z.string().trim().min(1, 'Le prénom est requis.'),
  gender: z.enum(['M', 'F'], { errorMap: () => ({ message: 'Le sexe est requis.' }) }),
  dateOfBirth: z.string().min(1, 'La date de naissance est requise.'),
  placeOfBirth: z.string().trim().optional(),
  nationality: z.string().trim().min(1, 'La nationalité est requise.'),
  address: z.string().trim().optional(),
  photoPath: z.string().optional(),
  classId: z.string().min(1, 'La classe est requise.'),
  previousSchool: z.string().trim().optional(),

  // Responsable
  guardians: z.array(guardianSchema).min(1, 'Au moins un responsable est requis.')
})

export type StudentFormValues = z.infer<typeof studentFormSchema>

/** Formulaire de fiche employé (F-022). */
export const employeeFormSchema = z.object({
  lastName: z.string().trim().min(1, 'Le nom est requis.'),
  firstName: z.string().trim().min(1, 'Le prénom est requis.'),
  role: z.string().trim().min(1, 'La fonction est requise.'),
  phone: z.string().trim().optional(),
  monthlySalary: z
    .number({ invalid_type_error: 'Le salaire mensuel est requis.' })
    .positive('Le salaire mensuel doit être positif.')
})

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>
