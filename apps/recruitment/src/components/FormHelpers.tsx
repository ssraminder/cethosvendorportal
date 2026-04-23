import { Upload } from 'lucide-react'
import type { UseFormReturn, FieldValues, Path } from 'react-hook-form'
import { FormSection } from './FormSection'

interface CvSectionProps {
  cvFile: File | null
  setCvFile: (f: File | null) => void
  handleCvUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function CvSection({ cvFile, setCvFile, handleCvUpload }: CvSectionProps) {
  return (
    <FormSection
      title="Resume / CV"
      description="Upload your most recent CV (PDF or DOCX, max 10MB). This helps us contextualize your experience."
    >
      <div className="space-y-3">
        {!cvFile ? (
          <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:border-cethos-teal transition-colors">
            <Upload className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-500">Click to upload your CV</span>
            <input
              type="file"
              accept=".pdf,.docx,.doc"
              className="sr-only"
              onChange={handleCvUpload}
            />
          </label>
        ) : (
          <div className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2">
            <span className="text-sm text-gray-700 truncate">{cvFile.name}</span>
            <button
              type="button"
              onClick={() => setCvFile(null)}
              className="text-gray-400 hover:text-red-500 text-sm"
            >
              Remove
            </button>
          </div>
        )}
      </div>
    </FormSection>
  )
}

interface ConsentSectionProps<T extends FieldValues> {
  form: UseFormReturn<T>
}

export function ConsentSection<T extends FieldValues>({ form }: ConsentSectionProps<T>) {
  const errors = form.formState.errors as Record<string, { message?: string } | undefined>
  return (
    <FormSection title="Consent">
      <div className="space-y-3">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            {...form.register('privacyPolicy' as Path<T>)}
            className="mt-0.5 text-cethos-teal focus:ring-cethos-teal"
          />
          <span className="text-sm text-gray-700">
            I agree to the{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-cethos-teal hover:text-cethos-teal-light underline">
              Privacy Policy
            </a>{' '}
            <span className="text-red-500">*</span>
          </span>
        </label>
        {errors.privacyPolicy?.message && (
          <p className="text-sm text-red-600 ml-6">{errors.privacyPolicy.message}</p>
        )}

        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            {...form.register('consentTest' as Path<T>)}
            className="mt-0.5 text-cethos-teal focus:ring-cethos-teal"
          />
          <span className="text-sm text-gray-700">
            I consent to receiving a skills test or assessment as part of this application <span className="text-red-500">*</span>
          </span>
        </label>
        {errors.consentTest?.message && (
          <p className="text-sm text-red-600 ml-6">{errors.consentTest.message}</p>
        )}

        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            {...form.register('consentUnpaid' as Path<T>)}
            className="mt-0.5 text-cethos-teal focus:ring-cethos-teal"
          />
          <span className="text-sm text-gray-700">
            I understand the test is unpaid <span className="text-red-500">*</span>
          </span>
        </label>
        {errors.consentUnpaid?.message && (
          <p className="text-sm text-red-600 ml-6">{errors.consentUnpaid.message}</p>
        )}
      </div>
    </FormSection>
  )
}
