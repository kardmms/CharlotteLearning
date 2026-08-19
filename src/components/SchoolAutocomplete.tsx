"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { CheckCircle2, Loader2, MapPin, Search } from "lucide-react";

type SchoolOption = {
  id: string;
  ncesSchoolId: string | null;
  name: string;
  districtName: string | null;
  street: string | null;
  city: string;
  state: string;
  zip: string | null;
  source: string;
  sourceYear: string;
};

type SchoolAutocompleteProps = {
  label?: string;
  required?: boolean;
};

function schoolLocation(option: SchoolOption) {
  return [option.city, option.state, option.zip].filter(Boolean).join(", ");
}

function isPersistedDirectoryOption(option: SchoolOption | null) {
  return Boolean(option && !option.id.startsWith("nces-public:"));
}

export function SchoolAutocomplete({ label = "School", required = true }: SchoolAutocompleteProps) {
  const inputId = useId();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<SchoolOption | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const selectedDirectoryId = useMemo(
    () => (isPersistedDirectoryOption(selectedSchool) ? selectedSchool?.id || "" : ""),
    [selectedSchool]
  );

  useEffect(() => {
    const cleanQuery = query.trim();
    if (cleanQuery.length < 2 || selectedSchool?.name === query) {
      setSchools([]);
      setIsLoading(false);
      setHasSearched(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      setHasSearched(true);
      try {
        const response = await fetch(`/api/schools/search?q=${encodeURIComponent(cleanQuery)}`, {
          signal: controller.signal
        });
        if (!response.ok) {
          setSchools([]);
          return;
        }
        const payload = (await response.json()) as { schools?: SchoolOption[] };
        setSchools(payload.schools || []);
        setIsOpen(true);
      } catch (error) {
        if (!controller.signal.aborted) setSchools([]);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, selectedSchool]);

  return (
    <div
      className="school-autocomplete"
      onBlur={() => {
        window.setTimeout(() => setIsOpen(false), 120);
      }}
      onFocus={() => {
        if (schools.length > 0) setIsOpen(true);
      }}
    >
      <label htmlFor={inputId}>{label}</label>
      <div className="school-autocomplete-combobox">
        <div className="school-autocomplete-control">
          <Search aria-hidden="true" size={18} />
          <input
            id={inputId}
            name="schoolName"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedSchool(null);
              setIsOpen(true);
            }}
            autoComplete="organization"
            aria-autocomplete="list"
            aria-controls={listId}
            aria-expanded={isOpen}
            maxLength={180}
            placeholder="Start typing your school name or ZIP"
            required={required}
          />
          {isLoading ? (
            <Loader2 className="school-autocomplete-spin" aria-label="Searching schools" size={18} />
          ) : selectedSchool ? (
            <CheckCircle2 className="school-autocomplete-confirmed" aria-label="School selected" size={18} />
          ) : null}
        </div>
        <input type="hidden" name="schoolDirectoryId" value={selectedDirectoryId} />
        {selectedSchool?.ncesSchoolId ? (
          <input type="hidden" name="schoolNcesId" value={selectedSchool.ncesSchoolId} />
        ) : null}
        {isOpen && (schools.length > 0 || (hasSearched && !isLoading && query.trim().length >= 2)) ? (
          <div className="school-autocomplete-results" id={listId} role="listbox">
            {schools.length > 0 ? (
              schools.map((school) => (
                <button
                  className="school-autocomplete-option"
                  key={school.id}
                  type="button"
                  role="option"
                  aria-selected={selectedSchool?.id === school.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setSelectedSchool(school);
                    setQuery(school.name);
                    setIsOpen(false);
                  }}
                >
                  <span className="school-autocomplete-name">{school.name}</span>
                  <span className="school-autocomplete-meta">
                    <MapPin aria-hidden="true" size={14} />
                    {schoolLocation(school)}
                  </span>
                  {school.districtName ? (
                    <span className="school-autocomplete-district">{school.districtName}</span>
                  ) : null}
                </button>
              ))
            ) : (
              <div className="school-autocomplete-empty">No official match yet. You can keep your typed school name.</div>
            )}
          </div>
        ) : null}
      </div>
      <span className="help-text">Pick the official match when it appears, or continue with your typed school name.</span>
    </div>
  );
}
