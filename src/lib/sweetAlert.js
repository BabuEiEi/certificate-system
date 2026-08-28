"use client";

import { useEffect } from "react";
import Swal from "sweetalert2";

const alertTitles = {
  success: "ดำเนินการสำเร็จ",
  error: "เกิดข้อผิดพลาด",
  warning: "โปรดตรวจสอบ",
  info: "แจ้งให้ทราบ",
  question: "ยืนยันการดำเนินการ",
};

const appAlert = Swal.mixin({
  buttonsStyling: false,
  confirmButtonText: "ตกลง",
  cancelButtonText: "ยกเลิก",
  reverseButtons: true,
  heightAuto: false,
  customClass: {
    popup: "app-swal-popup",
    title: "app-swal-title",
    htmlContainer: "app-swal-content",
    actions: "app-swal-actions",
    confirmButton: "app-swal-confirm",
    cancelButton: "app-swal-cancel",
  },
});

function alertText(message, details = []) {
  return [message, ...details]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join("\n");
}

export function showAppAlert({
  status = "info",
  title,
  message,
  details = [],
  ...options
}) {
  const icon = ["success", "error", "warning", "info", "question"].includes(status)
    ? status
    : "info";

  return appAlert.fire({
    icon,
    title: title ?? alertTitles[icon],
    text: alertText(message, details),
    ...options,
  });
}

export function showAppToast({ status = "success", message }) {
  return appAlert.fire({
    icon: status,
    title: message,
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    timer: 2200,
    timerProgressBar: true,
    customClass: {
      popup: "app-swal-toast",
      title: "app-swal-toast-title",
    },
  });
}

export async function confirmAppAction({ title, message, confirmButtonText = "ยืนยัน" }) {
  const result = await showAppAlert({
    status: "question",
    title,
    message,
    showCancelButton: true,
    focusCancel: true,
    confirmButtonText,
  });

  return result.isConfirmed;
}

export function useActionAlert(state) {
  useEffect(() => {
    if (!state?.message || !state?.submittedAt) return;

    const details = Object.values(state.errors ?? {}).flat().filter(Boolean);
    void showAppAlert({
      status: state.status,
      message: state.message,
      details,
    });
  }, [state?.errors, state?.message, state?.status, state?.submittedAt]);
}
