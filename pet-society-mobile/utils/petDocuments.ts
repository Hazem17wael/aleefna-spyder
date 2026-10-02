export type PetDocumentFields = {
  medical_record_pdf?: unknown;
  medical_record_pdf_url?: unknown;
  vaccination_pdf?: unknown;
  vaccination_pdf_url?: unknown;
  id_document_pdf?: unknown;
  id_document_pdf_url?: unknown;
  has_medical_record?: unknown;
  has_vaccination_pdf?: unknown;
  has_id_document?: unknown;
  is_vaccination_verified?: unknown;
};

export type PetDocumentStatus = {
  hasVaccinationPdf: boolean;
  isVaccinationVerified: boolean;
  hasMedicalRecord: boolean;
  hasIdDocument: boolean;
  vaccinationPdfUrl: string | null;
  medicalRecordPdfUrl: string | null;
  idDocumentPdfUrl: string | null;
};

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function truthyFlag(value: unknown) {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes";
  }

  return false;
}

export function getPetDocumentStatus(
  pet?: PetDocumentFields | null,
): PetDocumentStatus {
  const vaccinationPdfUrl = stringOrNull(pet?.vaccination_pdf_url);
  const medicalRecordPdfUrl = stringOrNull(pet?.medical_record_pdf_url);
  const idDocumentPdfUrl = stringOrNull(pet?.id_document_pdf_url);

  const hasVaccinationPdf =
    truthyFlag(pet?.has_vaccination_pdf) ||
    truthyFlag(pet?.is_vaccination_verified) ||
    Boolean(pet?.vaccination_pdf) ||
    Boolean(vaccinationPdfUrl);

  const hasMedicalRecord =
    truthyFlag(pet?.has_medical_record) ||
    Boolean(pet?.medical_record_pdf) ||
    Boolean(medicalRecordPdfUrl);

  const hasIdDocument =
    truthyFlag(pet?.has_id_document) ||
    Boolean(pet?.id_document_pdf) ||
    Boolean(idDocumentPdfUrl);

  return {
    hasVaccinationPdf,
    isVaccinationVerified:
      truthyFlag(pet?.is_vaccination_verified) || hasVaccinationPdf,
    hasMedicalRecord,
    hasIdDocument,
    vaccinationPdfUrl,
    medicalRecordPdfUrl,
    idDocumentPdfUrl,
  };
}

export function normalizePetDocumentFields<T extends Record<string, unknown>>(
  pet: T,
): T {
  const status = getPetDocumentStatus(pet);

  return {
    ...pet,
    medical_record_pdf_url: status.medicalRecordPdfUrl,
    vaccination_pdf_url: status.vaccinationPdfUrl,
    id_document_pdf_url: status.idDocumentPdfUrl,
    has_medical_record: status.hasMedicalRecord,
    has_vaccination_pdf: status.hasVaccinationPdf,
    has_id_document: status.hasIdDocument,
    is_vaccination_verified: status.isVaccinationVerified,
  };
}
