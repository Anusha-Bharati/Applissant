(async function autofillJobApplication() {
    try {
      const { profile } = await chrome.storage.local.get("profile");
  
      if (!profile) {
        console.log("Job Autofill: Save your profile first.");
        return;
      }
  
      const rules = [
        {
          key: "firstName",
          pattern: /\b(first[\s_-]*name|given[\s_-]*name)\b/i
        },
        {
          key: "lastName",
          pattern: /\b(last[\s_-]*name|surname|family[\s_-]*name)\b/i
        },
        {
          key: "email",
          pattern: /\b(email|e-mail)\b/i
        },
        {
          key: "phone",
          pattern: /\b(phone|telephone|mobile)\b/i
        },
        {
          key: "currentLocation",
          pattern: /\b(current location|location|city|town)\b/i
        },
        {
          key: "linkedin",
          pattern: /\blinkedin\b/i
        },
        {
          key: "github",
          pattern: /\bgithub\b/i
        },
        {
          key: "portfolio",
          pattern: /\b(portfolio|personal website|portfolio website)\b/i
        },
        {
          key: "currentCompany",
          pattern: /\b(current company|current employer|present employer)\b/i
        },
        {
          key: "noticePeriod",
          pattern: /\b(notice period|notice required|availability to start)\b/i
        },
        {
          key: "source",
          pattern: /\b(where did you hear|how did you hear|referral source|source of application)\b/i
        },
        {
          key: "rightToWorkDetails",
          pattern: /\b(further details regarding your right to work|right to work status|visa type|immigration status)\b/i
        }
      ];
  
      function getDescription(field) {
        const labels = Array.from(field.labels || [])
          .map(label => label.innerText)
          .join(" ");
  
        const labelledBy = field.getAttribute("aria-labelledby");
        const ariaText = labelledBy
          ? labelledBy.split(" ")
              .map(id => document.getElementById(id)?.innerText || "")
              .join(" ")
          : "";
  
        const group = field.closest(
          "fieldset, [role='group'], [data-field]"
        );
  
        return [
          field.name,
          field.id,
          field.placeholder,
          field.getAttribute("aria-label"),
          field.autocomplete,
          labels,
          ariaText,
          group?.innerText
        ].filter(Boolean).join(" ");
      }
  
      function setValue(field, value) {
        const prototype =
          field instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : field instanceof HTMLSelectElement
              ? HTMLSelectElement.prototype
              : HTMLInputElement.prototype;
  
        const setter = Object.getOwnPropertyDescriptor(
          prototype,
          "value"
        )?.set;
  
        if (setter) {
          setter.call(field, value);
        } else {
          field.value = value;
        }
  
        field.dispatchEvent(new Event("input", { bubbles: true }));
        field.dispatchEvent(new Event("change", { bubbles: true }));
      }
  
      function chooseOption(select, value) {
        const target = value.toLowerCase().trim();
  
        const option = Array.from(select.options).find(option => {
          const text = option.textContent.toLowerCase().trim();
          const optionValue = option.value.toLowerCase().trim();
  
          return (
            text === target ||
            optionValue === target ||
            (target && text.includes(target))
          );
        });
  
        if (option && !select.value) {
          setValue(select, option.value);
          return true;
        }
  
        return false;
      }
  
      let filledCount = 0;
  
      // Fill text, email, telephone, URL, select and textarea fields.
      const fields = document.querySelectorAll(
        "input:not([type='hidden']):not([type='password']):not([type='file']):not([type='radio']):not([type='checkbox']), textarea, select"
      );
  
      for (const field of fields) {
        if (
          field.disabled ||
          field.readOnly ||
          field.getClientRects().length === 0
        ) {
          continue;
        }
  
        const description = getDescription(field);
        const rule = rules.find(item => item.pattern.test(description));
  
        if (!rule) continue;
  
        const value = profile[rule.key];
  
        if (!value) continue;
  
        if (field instanceof HTMLSelectElement) {
          if (chooseOption(field, String(value))) {
            filledCount++;
          }
        } else if (!field.value.trim()) {
          setValue(field, String(value));
          filledCount++;
        }
      }
  
      // Handle native right-to-work radio buttons.
      const radios = Array.from(
        document.querySelectorAll("input[type='radio']")
      );
  
      const groups = new Map();
  
      for (const radio of radios) {
        const groupKey = radio.name || radio.id;
  
        if (!groupKey) continue;
  
        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
  
        groups.get(groupKey).push(radio);
      }
  
      for (const groupRadios of groups.values()) {
        const firstRadio = groupRadios[0];
        const group = firstRadio.closest(
          "fieldset, [role='group'], [data-field]"
        ) || firstRadio.parentElement?.parentElement;
  
        const question = group?.innerText || getDescription(firstRadio);
  
        if (!/\bright to work\b/i.test(question)) continue;
  
        if (groupRadios.some(radio => radio.checked)) continue;
  
        if (profile.rightToWork !== "yes") continue;
  
        const yesRadio = groupRadios.find(radio => {
          const label = Array.from(radio.labels || [])
            .map(item => item.innerText)
            .join(" ");
  
          return (
            /^yes\b/i.test(label.trim()) ||
            /^yes\b/i.test(radio.value)
          );
        });
  
        if (yesRadio) {
          yesRadio.click();
          filledCount++;
        }
      }
  
      console.log(`Job Autofill: ${filledCount} fields filled.`);
  
      await chrome.runtime.sendMessage({
        type: "AUTOFILL_RESULT",
        count: filledCount
      });
  
    } catch (error) {
      console.error("Job Autofill error:", error);
  
      await chrome.runtime.sendMessage({
        type: "AUTOFILL_RESULT",
        count: 0
      });
    }
  })();