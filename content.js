
(async () => {
    "use strict";
  
    // Prevent the script from running twice on the same page.
    if (window.__jobAutofillRunning) return;
    window.__jobAutofillRunning = true;
  
    const result = {
      filled: 0,
      skipped: 0,
      errors: 0
    };
  
    try {
      const { profile = {} } =
        await chrome.storage.local.get("profile");
  
      if (!profile || Object.keys(profile).length === 0) {
        console.info("Job Autofill: No saved profile found.");
        return;
      }
  
      // --------------------------------------------------
      // FIELD RECOGNITION RULES
      // Each profile key can recognise multiple question names.
      // --------------------------------------------------
  
      const FIELD_RULES = {
        firstName: [
          "first name",
          "given name",
          "forename",
          "preferred first name",
          "legal first name"
        ],
  
        lastName: [
          "last name",
          "surname",
          "family name",
          "second name"
        ],
  
        email: [
          "email",
          "email address",
          "e-mail",
          "personal email"
        ],
  
        phone: [
          "phone",
          "telephone",
          "mobile",
          "mobile phone",
          "contact number",
          "phone number"
        ],
  
        street1: [
          "street address",
          "address line 1",
          "address 1",
          "home street 1",
          "street 1"
        ],
  
        street2: [
          "address line 2",
          "address 2",
          "home street 2",
          "street 2"
        ],
  
        city: [
          "city",
          "town",
          "home city",
          "municipality"
        ],
  
        country: [
          "country",
          "home country",
          "country of residence",
          "residential country"
        ],
  
        postcode: [
          "postcode",
          "postal code",
          "zip code",
          "zip",
          "home post code"
        ],
  
        nationality: [
          "nationality",
          "citizenship",
          "national origin"
        ],
  
        currentCompany: [
          "current company",
          "current employer",
          "present employer",
          "employer name"
        ],
  
        currentJobTitle: [
          "current job title",
          "current position",
          "job title",
          "present role",
          "occupation"
        ],
  
        noticePeriod: [
          "notice period",
          "availability",
          "when can you start",
          "available to start"
        ],
  
        linkedin: [
          "linkedin",
          "linkedin url",
          "linkedin profile"
        ],
  
        github: [
          "github",
          "github url",
          "github profile"
        ],
  
        portfolio: [
          "portfolio",
          "portfolio url",
          "personal website",
          "website"
        ],
  
        currentSalary: [
          "current salary",
          "present salary",
          "existing salary",
          "current annual salary"
        ],
  
        salaryExpectation: [
          "salary expectation",
          "expected salary",
          "salary requirements",
          "desired salary",
          "salary expectations",
          "expected annual compensation",
          "desired compensation"
        ],
  
        salaryCurrency: [
          "salary currency",
          "currency"
        ],
  
        salaryFrequency: [
          "salary frequency",
          "pay frequency",
          "salary basis"
        ],
  
        visaStatus: [
          "visa status",
          "immigration status",
          "residency status"
        ],
  
        visaExpiryDate: [
          "visa expiry",
          "visa expiration",
          "visa expiry date",
          "permit expiry date"
        ],
  
        rightToWork: [
          "right to work",
          "right to live and work",
          "legally authorised to work",
          "legally authorized to work",
          "eligible to work",
          "work eligibility"
        ],
  
        sponsorshipRequired: [
          "visa sponsorship",
          "require sponsorship",
          "require visa sponsorship",
          "sponsorship required"
        ],
  
        workPermitDetails: [
          "work permit details",
          "immigration details",
          "visa details"
        ],
  
        applicationSource: [
          "where did you hear about us",
          "how did you hear about us",
          "source of application",
          "application source",
          "referral source",
          "how did you find this job"
        ],
  
        rightToWorkDetails: [
          "additional right to work information",
          "right to work details",
          "work eligibility details"
        ]
      };
  
      // --------------------------------------------------
      // NORMALISE TEXT FOR MATCHING
      // --------------------------------------------------
  
      function normalise(value) {
        return String(value || "")
          .toLowerCase()
          .replace(/[*:]/g, " ")
          .replace(/[_-]/g, " ")
          .replace(/[^\p{L}\p{N}\s]/gu, " ")
          .replace(/\s+/g, " ")
          .trim();
      }
  
      // --------------------------------------------------
      // GET FIELD LABELS
      // --------------------------------------------------
  
      function getFieldText(element) {
        const parts = [];
  
        if (element.labels) {
          for (const label of element.labels) {
            parts.push(label.innerText);
          }
        }
  
        if (element.id) {
          const label = document.querySelector(
            `label[for="${CSS.escape(element.id)}"]`
          );
  
          if (label) parts.push(label.innerText);
        }
  
        if (element.getAttribute("aria-label")) {
          parts.push(element.getAttribute("aria-label"));
        }
  
        if (element.getAttribute("placeholder")) {
          parts.push(element.getAttribute("placeholder"));
        }
  
        if (element.getAttribute("autocomplete")) {
          parts.push(element.getAttribute("autocomplete"));
        }
  
        if (element.name) parts.push(element.name);
        if (element.id) parts.push(element.id);
  
        const labelledBy = element.getAttribute("aria-labelledby");
  
        if (labelledBy) {
          for (const id of labelledBy.split(/\s+/)) {
            const label = document.getElementById(id);
            if (label) parts.push(label.innerText);
          }
        }
  
        // Look for nearby question text.
        const container = element.closest(
          '[role="group"], fieldset, .field, .form-field'
        );
  
        if (container) {
          parts.push(container.innerText);
        }
  
        return normalise(parts.join(" "));
      }
  
      // --------------------------------------------------
      // MATCH A FORM FIELD TO A PROFILE KEY
      // --------------------------------------------------
  
      function findProfileKey(element) {
        const text = getFieldText(element);
  
        if (!text) return null;
  
        for (const [key, phrases] of Object.entries(FIELD_RULES)) {
          for (const phrase of phrases) {
            const normalPhrase = normalise(phrase);
  
            if (
              text === normalPhrase ||
              text.includes(normalPhrase)
            ) {
              return key;
            }
          }
        }
  
        return null;
      }
  
      // --------------------------------------------------
      // SAFELY CHECK WHETHER A FIELD CAN BE FILLED
      // --------------------------------------------------
  
      function canFill(element) {
        if (!element || !element.isConnected) return false;
        if (element.disabled || element.readOnly) return false;
  
        if (
          element.type === "hidden" ||
          element.type === "password" ||
          element.type === "file" ||
          element.type === "submit" ||
          element.type === "button" ||
          element.type === "reset"
        ) {
          return false;
        }
  
        if (
          element.getAttribute("aria-hidden") === "true" ||
          element.closest('[aria-hidden="true"]')
        ) {
          return false;
        }
  
        const style = window.getComputedStyle(element);
  
        if (
          style.display === "none" ||
          style.visibility === "hidden"
        ) {
          return false;
        }
  
        // Do not overwrite information already entered.
        if (
          element.type === "checkbox" ||
          element.type === "radio"
        ) {
          return !element.checked;
        }
  
        return !String(element.value || "").trim();
      }
  
      // --------------------------------------------------
      // SET VALUE USING NATIVE ELEMENT SETTERS
      // Helps React and other controlled forms detect changes.
      // --------------------------------------------------
  
      function setNativeValue(element, value) {
        const prototype =
          element instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : element instanceof HTMLSelectElement
              ? HTMLSelectElement.prototype
              : HTMLInputElement.prototype;
  
        const setter = Object.getOwnPropertyDescriptor(
          prototype,
          "value"
        )?.set;
  
        if (setter) {
          setter.call(element, String(value));
        } else {
          element.value = String(value);
        }
  
        element.dispatchEvent(
          new Event("input", { bubbles: true })
        );
  
        element.dispatchEvent(
          new Event("change", { bubbles: true })
        );
      }
  
      // --------------------------------------------------
      // MATCH DROPDOWN OPTIONS
      // --------------------------------------------------
  
      function fillSelect(element, value) {
        const target = normalise(value);
  
        if (!target) return false;
  
        const options = Array.from(element.options);
  
        const option = options.find(option => {
          const text = normalise(option.textContent);
          const optionValue = normalise(option.value);
  
          return (
            text === target ||
            optionValue === target
          );
        });
  
        if (!option || option.disabled) return false;
  
        element.value = option.value;
  
        element.dispatchEvent(
          new Event("input", { bubbles: true })
        );
  
        element.dispatchEvent(
          new Event("change", { bubbles: true })
        );
  
        return true;
      }
  
      // --------------------------------------------------
      // RADIO BUTTONS
      // --------------------------------------------------
  
      function fillRadio(element, value) {
        const target = normalise(value);
  
        if (!target || !element.name) return false;
  
        const radios = Array.from(
          document.querySelectorAll(
            `input[type="radio"][name="${CSS.escape(element.name)}"]`
          )
        );
  
        const match = radios.find(radio => {
          const labelText = radio.labels
            ? Array.from(radio.labels)
                .map(label => label.innerText)
                .join(" ")
            : "";
  
          return (
            normalise(radio.value) === target ||
            normalise(labelText) === target
          );
        });
  
        if (!match || match.disabled) return false;
  
        match.click();
        return true;
      }
  
      // --------------------------------------------------
      // CHECKBOXES
      // Only fill explicit profile answers.
      // Consent is never assumed.
      // --------------------------------------------------
  
      function fillCheckbox(element, value) {
        const target = normalise(value);
  
        if (!target) return false;
  
        const yesValues = [
          "yes",
          "true",
          "agree",
          "agreed",
          "accept",
          "accepted"
        ];
  
        const noValues = [
          "no",
          "false",
          "disagree",
          "decline",
          "declined"
        ];
  
        let shouldCheck = null;
  
        if (yesValues.includes(target)) {
          shouldCheck = true;
        } else if (noValues.includes(target)) {
          shouldCheck = false;
        }
  
        if (shouldCheck === null) return false;
  
        if (element.checked !== shouldCheck) {
          element.click();
        }
  
        return true;
      }
  
      // --------------------------------------------------
      // PROCESS STANDARD FORM ELEMENTS
      // --------------------------------------------------
  
      const fields = Array.from(
        document.querySelectorAll(
          "input, textarea, select"
        )
      );
  
      for (const element of fields) {
        if (!canFill(element)) {
          result.skipped++;
          continue;
        }
  
        const key = findProfileKey(element);
  
        if (!key) {
          result.skipped++;
          continue;
        }
  
        const value = profile[key];
  
        if (
          value === undefined ||
          value === null ||
          String(value).trim() === ""
        ) {
          result.skipped++;
          continue;
        }
  
        try {
          let success = false;
  
          if (element.tagName === "SELECT") {
            success = fillSelect(element, value);
          } else if (element.type === "radio") {
            success = fillRadio(element, value);
          } else if (element.type === "checkbox") {
            success = fillCheckbox(element, value);
          } else {
            setNativeValue(element, value);
            success = true;
          }
  
          if (success) {
            result.filled++;
          } else {
            result.skipped++;
          }
        } catch (error) {
          console.warn(
            `Job Autofill: Could not fill ${key}`,
            error
          );
  
          result.errors++;
        }
      }
  
      // --------------------------------------------------
      // REPORT RESULT
      // --------------------------------------------------
  
      console.info("Job Autofill result:", result);
  
      chrome.runtime.sendMessage({
        type: "AUTOFILL_RESULT",
        count: result.filled,
        skipped: result.skipped,
        errors: result.errors
      }).catch(() => {
        // The page may not have an active extension connection.
      });
  
    } catch (error) {
      console.error("Job Autofill error:", error);
    } finally {
      window.__jobAutofillRunning = false;
    }
  })();
  