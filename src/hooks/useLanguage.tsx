import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type Language = "pt-BR" | "es" | "en";

interface Translations {
  [key: string]: {
    [key: string]: string;
  };
}

const translations: Translations = {
  "pt-BR": {
    // Common
    "common.loading": "Carregando...",
    "common.save": "Salvar",
    "common.cancel": "Cancelar",
    "common.delete": "Excluir",
    "common.edit": "Editar",
    "common.create": "Criar",
    "common.search": "Buscar",
    "common.filter": "Filtrar",
    "common.export": "Exportar",
    "common.download": "Download",
    "common.success": "Sucesso",
    "common.error": "Erro",
    "common.confirm": "Confirmar",
    "common.back": "Voltar",
    "common.next": "Próximo",
    "common.previous": "Anterior",
    "common.close": "Fechar",
    "common.add": "Adicionar",
    "common.remove": "Remover",
    "common.active": "Ativo",
    "common.inactive": "Inativo",
    "common.yes": "Sim",
    "common.no": "Não",

    // Navigation
    "nav.dashboard": "Dashboard",
    "nav.metrics": "Métricas",
    "nav.analytics": "Analytics",
    "nav.importStats": "Estatísticas Import.",
    "nav.mercadoLivre": "Mercado Livre",
    "nav.import": "Importar Produto",
    "nav.products": "Produtos",
    "nav.orders": "Pedidos",
    "nav.shippingQueue": "Fila de Envios",
    "nav.ordersMonitor": "Monitor Pedidos",
    "nav.sales": "Vendas",
    "nav.history": "Histórico",
    "nav.connectionDiag": "Diag. Conexão",
    "nav.publicationDiag": "Diag. Publicações",
    "nav.settings": "Configurações",
    "nav.reports": "Relatórios",
    "nav.webhooks": "Webhooks",
    "nav.logout": "Sair",

    // Import Statistics
    "importStats.title": "Estatísticas de Importação",
    "importStats.subtitle": "Dashboard completo de importações em lote",
    "importStats.statsTab": "Estatísticas",
    "importStats.pendingTab": "Pendentes",
    "importStats.monitorTab": "Monitoramento",
    "importStats.staleAlertTitle": "Importações Pausadas há Mais de 24h",
    "importStats.staleAlertDesc": "As seguintes importações estão pausadas há mais de 24 horas e podem precisar de atenção.",
    "importStats.resumeAll": "Retomar Todas",
    "common.refresh": "Atualizar",

    // Cron Job Monitor
    "cronMonitor.totalExecutions": "Execuções",
    "cronMonitor.successRate": "Taxa de Sucesso",
    "cronMonitor.alertsSent": "Alertas Enviados",
    "cronMonitor.avgDuration": "Duração Média",
    "cronMonitor.activityChart": "Atividade dos Últimos 7 Dias",
    "cronMonitor.activityChartDesc": "Execuções do cron job e alertas enviados",
    "cronMonitor.executionHistory": "Histórico de Execuções",
    "cronMonitor.executionHistoryDesc": "Últimas execuções do cron job check-stale-imports",
    "cronMonitor.alertHistory": "Histórico de Alertas",
    "cronMonitor.alertHistoryDesc": "Alertas de importações pausadas enviados via webhook",
    "cronMonitor.noExecutions": "Nenhuma execução registrada ainda",
    "cronMonitor.noExecutionsDesc": "O cron job é executado automaticamente a cada hora",
    "cronMonitor.noAlerts": "Nenhum alerta enviado ainda",
    "cronMonitor.noAlertsDesc": "Alertas são enviados quando importações ficam pausadas por mais de 24h",
    "cronMonitor.settings": "Configurações",
    "cronMonitor.pushNotifications": "Notificações Push",
    "cronMonitor.pushNotificationsDesc": "Receba alertas no navegador quando importações pausadas forem detectadas",
    "cronMonitor.pushNotSupported": "Notificações push não são suportadas neste navegador",
    "cronMonitor.minInterval": "Intervalo Mínimo entre Execuções Manuais",
    "cronMonitor.minIntervalDesc": "Tempo mínimo de espera entre execuções manuais para evitar sobrecarga",
    "cronMonitor.minutes": "min",
    "cronMonitor.manualRun": "Execução Manual",
    "cronMonitor.manualRunDesc": "Execute a verificação de importações pausadas agora",
    "cronMonitor.runNow": "Executar Agora",
    "cronMonitor.manualRunSuccess": "Verificação executada com sucesso!",
    "cronMonitor.manualRunError": "Erro ao executar verificação",
    "cronMonitor.cooldownActive": "Aguarde",
    "cronMonitor.cooldownError": "Aguarde antes de executar novamente",
    "cronMonitor.minutesRemaining": "minuto(s) restante(s)",
    "cronMonitor.alertNotificationTitle": "⚠️ Alerta de Importação",
    "cronMonitor.alertNotificationBody": "importações pausadas há mais de 24h",
    "cronMonitor.manualCheckComplete": "Verificação Concluída",
    "cronMonitor.staleImportsFound": "importações pausadas encontradas",

    // Settings
    "settings.title": "Configurações",
    "settings.subtitle": "Gerencie sua conta e preferências",
    "settings.appearance": "Aparência",
    "settings.appearance.desc": "Personalize a aparência do sistema",
    "settings.theme": "Tema",
    "settings.theme.light": "Claro",
    "settings.theme.dark": "Escuro",
    "settings.theme.system": "Sistema",
    "settings.theme.desc": "Escolha entre tema claro, escuro ou siga as preferências do sistema.",
    "settings.language": "Idioma",
    "settings.language.desc": "Selecione o idioma da interface",
    "settings.ai": "Inteligência Artificial",
    "settings.ai.desc": "Configure o comportamento da IA na otimização de produtos",
    "settings.ai.autoTitle": "Otimização automática de títulos",
    "settings.ai.autoTitle.desc": "Reescrever títulos para melhor SEO no Mercado Livre",
    "settings.ai.enrichDesc": "Enriquecimento de descrições",
    "settings.ai.enrichDesc.desc": "Adicionar formatação e CTAs nas descrições",
    "settings.ai.fixAttrs": "Correção de atributos",
    "settings.ai.fixAttrs.desc": "Ajustar automaticamente atributos obrigatórios",
    "settings.ai.preValidation": "Validação pré-publicação",
    "settings.ai.preValidation.desc": "Verificar regras do ML antes de publicar",
    "settings.notifications": "Notificações",
    "settings.notifications.desc": "Configure como deseja receber alertas do sistema",
    "settings.notifications.success": "Publicações bem-sucedidas",
    "settings.notifications.success.desc": "Notificar quando um produto for publicado",
    "settings.notifications.errors": "Erros de publicação",
    "settings.notifications.errors.desc": "Alertar sobre falhas na publicação",
    "settings.notifications.token": "Renovação de token",
    "settings.notifications.token.desc": "Avisar quando o token for renovado",
    "settings.security": "Segurança",
    "settings.security.desc": "Informações sobre segurança e criptografia",
    "settings.security.encrypted": "Tokens criptografados",
    "settings.security.encrypted.desc": "Todos os tokens OAuth são armazenados de forma segura. As comunicações com a API do Mercado Livre são feitas exclusivamente via HTTPS.",
    "settings.ml": "Conexão Mercado Livre",
    "settings.ml.desc": "Gerencie a conexão OAuth com sua conta do Mercado Livre",
    "settings.ml.connected": "Conta conectada",
    "settings.ml.expired": "Expirado",
    "settings.ml.active": "Ativo",
    "settings.ml.tokenExpired": "Token expirado",
    "settings.ml.tokenValid": "Token válido",
    "settings.ml.refresh": "Renovar Token",
    "settings.ml.disconnect": "Desconectar",
    "settings.ml.notConnected": "Mercado Livre não conectado",
    "settings.ml.notConnected.desc": "Conecte sua conta para começar a publicar produtos",
    "settings.ml.connect": "Conectar Mercado Livre",
    "settings.ml.confirmDisconnect": "Tem certeza que deseja desconectar sua conta do Mercado Livre?",

    // Reports
    "reports.title": "Relatórios",
    "reports.subtitle": "Visualize e exporte relatórios de operações",
    "reports.monthly": "Relatório Mensal",
    "reports.monthly.desc": "Resumo de todas as operações do mês selecionado",
    "reports.selectMonth": "Selecionar mês",
    "reports.generate": "Gerar Relatório",
    "reports.download": "Download PDF",
    "reports.noData": "Nenhum dado encontrado para o período selecionado",
    "reports.summary": "Resumo do Período",
    "reports.totalOperations": "Total de Operações",
    "reports.successRate": "Taxa de Sucesso",
    "reports.errors": "Erros",
    "reports.byType": "Por Tipo de Operação",
    "reports.byDay": "Por Dia",

    // Webhooks
    "webhooks.title": "Webhooks",
    "webhooks.subtitle": "Configure notificações para sistemas externos",
    "webhooks.create": "Criar Webhook",
    "webhooks.name": "Nome",
    "webhooks.url": "URL",
    "webhooks.events": "Eventos",
    "webhooks.secret": "Segredo (opcional)",
    "webhooks.status": "Status",
    "webhooks.lastTriggered": "Último disparo",
    "webhooks.never": "Nunca",
    "webhooks.noWebhooks": "Nenhum webhook configurado",
    "webhooks.noWebhooks.desc": "Crie um webhook para receber notificações sobre eventos importantes",
    "webhooks.logs": "Histórico de Entregas",
    "webhooks.event.publish_success": "Publicação bem-sucedida",
    "webhooks.event.publish_error": "Erro de publicação",
    "webhooks.event.batch_import_complete": "Importação em lote concluída",
    "webhooks.event.import_success": "Importação bem-sucedida",
    "webhooks.event.import_error": "Erro de importação",
    "webhooks.event.token_refresh": "Renovação de token",
    "webhooks.event.token_error": "Erro de token",
    "webhooks.confirmDelete": "Tem certeza que deseja excluir este webhook?",
  },
  es: {
    // Common
    "common.loading": "Cargando...",
    "common.save": "Guardar",
    "common.cancel": "Cancelar",
    "common.delete": "Eliminar",
    "common.edit": "Editar",
    "common.create": "Crear",
    "common.search": "Buscar",
    "common.filter": "Filtrar",
    "common.export": "Exportar",
    "common.download": "Descargar",
    "common.success": "Éxito",
    "common.error": "Error",
    "common.confirm": "Confirmar",
    "common.back": "Volver",
    "common.next": "Siguiente",
    "common.previous": "Anterior",
    "common.close": "Cerrar",
    "common.add": "Agregar",
    "common.remove": "Eliminar",
    "common.active": "Activo",
    "common.inactive": "Inactivo",
    "common.yes": "Sí",
    "common.no": "No",

    // Navigation
    "nav.dashboard": "Panel",
    "nav.metrics": "Métricas",
    "nav.analytics": "Analytics",
    "nav.importStats": "Estadísticas Import.",
    "nav.mercadoLivre": "Mercado Libre",
    "nav.import": "Importar Producto",
    "nav.products": "Productos",
    "nav.orders": "Pedidos",
    "nav.shippingQueue": "Cola de Envíos",
    "nav.ordersMonitor": "Monitor de Pedidos",
    "nav.sales": "Ventas",
    "nav.history": "Historial",
    "nav.connectionDiag": "Diag. Conexión",
    "nav.publicationDiag": "Diag. Publicaciones",
    "nav.settings": "Configuración",
    "nav.reports": "Informes",
    "nav.webhooks": "Webhooks",
    "nav.logout": "Salir",

    // Import Statistics
    "importStats.title": "Estadísticas de Importación",
    "importStats.subtitle": "Dashboard completo de importaciones en lote",
    "importStats.statsTab": "Estadísticas",
    "importStats.pendingTab": "Pendientes",
    "importStats.monitorTab": "Monitoreo",
    "importStats.staleAlertTitle": "Importaciones Pausadas por Más de 24h",
    "importStats.staleAlertDesc": "Las siguientes importaciones están pausadas por más de 24 horas y pueden necesitar atención.",
    "importStats.resumeAll": "Reanudar Todas",
    "common.refresh": "Actualizar",

    // Cron Job Monitor
    "cronMonitor.totalExecutions": "Ejecuciones",
    "cronMonitor.successRate": "Tasa de Éxito",
    "cronMonitor.alertsSent": "Alertas Enviadas",
    "cronMonitor.avgDuration": "Duración Promedio",
    "cronMonitor.activityChart": "Actividad de los Últimos 7 Días",
    "cronMonitor.activityChartDesc": "Ejecuciones del cron job y alertas enviadas",
    "cronMonitor.executionHistory": "Historial de Ejecuciones",
    "cronMonitor.executionHistoryDesc": "Últimas ejecuciones del cron job check-stale-imports",
    "cronMonitor.alertHistory": "Historial de Alertas",
    "cronMonitor.alertHistoryDesc": "Alertas de importaciones pausadas enviadas via webhook",
    "cronMonitor.noExecutions": "Ninguna ejecución registrada aún",
    "cronMonitor.noExecutionsDesc": "El cron job se ejecuta automáticamente cada hora",
    "cronMonitor.noAlerts": "Ninguna alerta enviada aún",
    "cronMonitor.noAlertsDesc": "Se envían alertas cuando las importaciones están pausadas por más de 24h",
    "cronMonitor.settings": "Configuración",
    "cronMonitor.pushNotifications": "Notificaciones Push",
    "cronMonitor.pushNotificationsDesc": "Recibe alertas en el navegador cuando se detecten importaciones pausadas",
    "cronMonitor.pushNotSupported": "Las notificaciones push no son compatibles con este navegador",
    "cronMonitor.minInterval": "Intervalo Mínimo entre Ejecuciones Manuales",
    "cronMonitor.minIntervalDesc": "Tiempo mínimo de espera entre ejecuciones manuales para evitar sobrecarga",
    "cronMonitor.minutes": "min",
    "cronMonitor.manualRun": "Ejecución Manual",
    "cronMonitor.manualRunDesc": "Ejecuta la verificación de importaciones pausadas ahora",
    "cronMonitor.runNow": "Ejecutar Ahora",
    "cronMonitor.manualRunSuccess": "¡Verificación ejecutada con éxito!",
    "cronMonitor.manualRunError": "Error al ejecutar verificación",
    "cronMonitor.cooldownActive": "Espere",
    "cronMonitor.cooldownError": "Espere antes de ejecutar nuevamente",
    "cronMonitor.minutesRemaining": "minuto(s) restante(s)",
    "cronMonitor.alertNotificationTitle": "⚠️ Alerta de Importación",
    "cronMonitor.alertNotificationBody": "importaciones pausadas por más de 24h",
    "cronMonitor.manualCheckComplete": "Verificación Completada",
    "cronMonitor.staleImportsFound": "importaciones pausadas encontradas",

    // Settings
    "settings.title": "Configuración",
    "settings.subtitle": "Administra tu cuenta y preferencias",
    "settings.appearance": "Apariencia",
    "settings.appearance.desc": "Personaliza la apariencia del sistema",
    "settings.theme": "Tema",
    "settings.theme.light": "Claro",
    "settings.theme.dark": "Oscuro",
    "settings.theme.system": "Sistema",
    "settings.theme.desc": "Elige entre tema claro, oscuro o sigue las preferencias del sistema.",
    "settings.language": "Idioma",
    "settings.language.desc": "Selecciona el idioma de la interfaz",
    "settings.ai": "Inteligencia Artificial",
    "settings.ai.desc": "Configura el comportamiento de la IA en la optimización de productos",
    "settings.ai.autoTitle": "Optimización automática de títulos",
    "settings.ai.autoTitle.desc": "Reescribir títulos para mejor SEO en Mercado Libre",
    "settings.ai.enrichDesc": "Enriquecimiento de descripciones",
    "settings.ai.enrichDesc.desc": "Agregar formato y CTAs en las descripciones",
    "settings.ai.fixAttrs": "Corrección de atributos",
    "settings.ai.fixAttrs.desc": "Ajustar automáticamente atributos obligatorios",
    "settings.ai.preValidation": "Validación pre-publicación",
    "settings.ai.preValidation.desc": "Verificar reglas de ML antes de publicar",
    "settings.notifications": "Notificaciones",
    "settings.notifications.desc": "Configura cómo deseas recibir alertas del sistema",
    "settings.notifications.success": "Publicaciones exitosas",
    "settings.notifications.success.desc": "Notificar cuando un producto sea publicado",
    "settings.notifications.errors": "Errores de publicación",
    "settings.notifications.errors.desc": "Alertar sobre fallas en la publicación",
    "settings.notifications.token": "Renovación de token",
    "settings.notifications.token.desc": "Avisar cuando el token sea renovado",
    "settings.security": "Seguridad",
    "settings.security.desc": "Información sobre seguridad y encriptación",
    "settings.security.encrypted": "Tokens encriptados",
    "settings.security.encrypted.desc": "Todos los tokens OAuth se almacenan de forma segura. Las comunicaciones con la API de Mercado Libre se realizan exclusivamente vía HTTPS.",
    "settings.ml": "Conexión Mercado Libre",
    "settings.ml.desc": "Administra la conexión OAuth con tu cuenta de Mercado Libre",
    "settings.ml.connected": "Cuenta conectada",
    "settings.ml.expired": "Expirado",
    "settings.ml.active": "Activo",
    "settings.ml.tokenExpired": "Token expirado",
    "settings.ml.tokenValid": "Token válido",
    "settings.ml.refresh": "Renovar Token",
    "settings.ml.disconnect": "Desconectar",
    "settings.ml.notConnected": "Mercado Libre no conectado",
    "settings.ml.notConnected.desc": "Conecta tu cuenta para comenzar a publicar productos",
    "settings.ml.connect": "Conectar Mercado Libre",
    "settings.ml.confirmDisconnect": "¿Estás seguro de que deseas desconectar tu cuenta de Mercado Libre?",

    // Reports
    "reports.title": "Informes",
    "reports.subtitle": "Visualiza y exporta informes de operaciones",
    "reports.monthly": "Informe Mensual",
    "reports.monthly.desc": "Resumen de todas las operaciones del mes seleccionado",
    "reports.selectMonth": "Seleccionar mes",
    "reports.generate": "Generar Informe",
    "reports.download": "Descargar PDF",
    "reports.noData": "No se encontraron datos para el período seleccionado",
    "reports.summary": "Resumen del Período",
    "reports.totalOperations": "Total de Operaciones",
    "reports.successRate": "Tasa de Éxito",
    "reports.errors": "Errores",
    "reports.byType": "Por Tipo de Operación",
    "reports.byDay": "Por Día",

    // Webhooks
    "webhooks.title": "Webhooks",
    "webhooks.subtitle": "Configura notificaciones para sistemas externos",
    "webhooks.create": "Crear Webhook",
    "webhooks.name": "Nombre",
    "webhooks.url": "URL",
    "webhooks.events": "Eventos",
    "webhooks.secret": "Secreto (opcional)",
    "webhooks.status": "Estado",
    "webhooks.lastTriggered": "Último disparo",
    "webhooks.never": "Nunca",
    "webhooks.noWebhooks": "Ningún webhook configurado",
    "webhooks.noWebhooks.desc": "Crea un webhook para recibir notificaciones sobre eventos importantes",
    "webhooks.logs": "Historial de Entregas",
    "webhooks.event.publish_success": "Publicación exitosa",
    "webhooks.event.publish_error": "Error de publicación",
    "webhooks.event.batch_import_complete": "Importación en lote completada",
    "webhooks.event.import_success": "Importación exitosa",
    "webhooks.event.import_error": "Error de importación",
    "webhooks.event.token_refresh": "Renovación de token",
    "webhooks.event.token_error": "Error de token",
    "webhooks.confirmDelete": "¿Estás seguro de que deseas eliminar este webhook?",
  },
  en: {
    // Common
    "common.loading": "Loading...",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.create": "Create",
    "common.search": "Search",
    "common.filter": "Filter",
    "common.export": "Export",
    "common.download": "Download",
    "common.success": "Success",
    "common.error": "Error",
    "common.confirm": "Confirm",
    "common.back": "Back",
    "common.next": "Next",
    "common.previous": "Previous",
    "common.close": "Close",
    "common.add": "Add",
    "common.remove": "Remove",
    "common.active": "Active",
    "common.inactive": "Inactive",
    "common.yes": "Yes",
    "common.no": "No",

    // Navigation
    "nav.dashboard": "Dashboard",
    "nav.metrics": "Metrics",
    "nav.analytics": "Analytics",
    "nav.importStats": "Import Stats",
    "nav.mercadoLivre": "Mercado Livre",
    "nav.import": "Import Product",
    "nav.products": "Products",
    "nav.orders": "Orders",
    "nav.shippingQueue": "Shipping Queue",
    "nav.ordersMonitor": "Orders Monitor",
    "nav.sales": "Sales",
    "nav.history": "History",
    "nav.connectionDiag": "Connection Diag.",
    "nav.publicationDiag": "Publication Diag.",
    "nav.settings": "Settings",
    "nav.reports": "Reports",
    "nav.webhooks": "Webhooks",
    "nav.logout": "Logout",

    // Import Statistics
    "importStats.title": "Import Statistics",
    "importStats.subtitle": "Complete batch import dashboard",
    "importStats.statsTab": "Statistics",
    "importStats.pendingTab": "Pending",
    "importStats.monitorTab": "Monitoring",
    "importStats.staleAlertTitle": "Imports Paused for Over 24h",
    "importStats.staleAlertDesc": "The following imports have been paused for over 24 hours and may need attention.",
    "importStats.resumeAll": "Resume All",
    "common.refresh": "Refresh",

    // Cron Job Monitor
    "cronMonitor.totalExecutions": "Executions",
    "cronMonitor.successRate": "Success Rate",
    "cronMonitor.alertsSent": "Alerts Sent",
    "cronMonitor.avgDuration": "Avg Duration",
    "cronMonitor.activityChart": "Last 7 Days Activity",
    "cronMonitor.activityChartDesc": "Cron job executions and alerts sent",
    "cronMonitor.executionHistory": "Execution History",
    "cronMonitor.executionHistoryDesc": "Recent check-stale-imports cron job executions",
    "cronMonitor.alertHistory": "Alert History",
    "cronMonitor.alertHistoryDesc": "Stale import alerts sent via webhook",
    "cronMonitor.noExecutions": "No executions recorded yet",
    "cronMonitor.noExecutionsDesc": "The cron job runs automatically every hour",
    "cronMonitor.noAlerts": "No alerts sent yet",
    "cronMonitor.noAlertsDesc": "Alerts are sent when imports are paused for over 24h",
    "cronMonitor.settings": "Settings",
    "cronMonitor.pushNotifications": "Push Notifications",
    "cronMonitor.pushNotificationsDesc": "Receive browser alerts when paused imports are detected",
    "cronMonitor.pushNotSupported": "Push notifications are not supported in this browser",
    "cronMonitor.minInterval": "Minimum Interval Between Manual Runs",
    "cronMonitor.minIntervalDesc": "Minimum wait time between manual runs to prevent overload",
    "cronMonitor.minutes": "min",
    "cronMonitor.manualRun": "Manual Run",
    "cronMonitor.manualRunDesc": "Run the paused imports check now",
    "cronMonitor.runNow": "Run Now",
    "cronMonitor.manualRunSuccess": "Check executed successfully!",
    "cronMonitor.manualRunError": "Error executing check",
    "cronMonitor.cooldownActive": "Wait",
    "cronMonitor.cooldownError": "Wait before running again",
    "cronMonitor.minutesRemaining": "minute(s) remaining",
    "cronMonitor.alertNotificationTitle": "⚠️ Import Alert",
    "cronMonitor.alertNotificationBody": "imports paused for over 24h",
    "cronMonitor.manualCheckComplete": "Check Complete",
    "cronMonitor.staleImportsFound": "paused imports found",

    // Settings
    "settings.title": "Settings",
    "settings.subtitle": "Manage your account and preferences",
    "settings.appearance": "Appearance",
    "settings.appearance.desc": "Customize the system appearance",
    "settings.theme": "Theme",
    "settings.theme.light": "Light",
    "settings.theme.dark": "Dark",
    "settings.theme.system": "System",
    "settings.theme.desc": "Choose between light, dark theme or follow system preferences.",
    "settings.language": "Language",
    "settings.language.desc": "Select the interface language",
    "settings.ai": "Artificial Intelligence",
    "settings.ai.desc": "Configure AI behavior in product optimization",
    "settings.ai.autoTitle": "Automatic title optimization",
    "settings.ai.autoTitle.desc": "Rewrite titles for better SEO on Mercado Livre",
    "settings.ai.enrichDesc": "Description enrichment",
    "settings.ai.enrichDesc.desc": "Add formatting and CTAs to descriptions",
    "settings.ai.fixAttrs": "Attribute correction",
    "settings.ai.fixAttrs.desc": "Automatically adjust required attributes",
    "settings.ai.preValidation": "Pre-publication validation",
    "settings.ai.preValidation.desc": "Verify ML rules before publishing",
    "settings.notifications": "Notifications",
    "settings.notifications.desc": "Configure how you want to receive system alerts",
    "settings.notifications.success": "Successful publications",
    "settings.notifications.success.desc": "Notify when a product is published",
    "settings.notifications.errors": "Publication errors",
    "settings.notifications.errors.desc": "Alert about publication failures",
    "settings.notifications.token": "Token renewal",
    "settings.notifications.token.desc": "Notify when token is renewed",
    "settings.security": "Security",
    "settings.security.desc": "Security and encryption information",
    "settings.security.encrypted": "Encrypted tokens",
    "settings.security.encrypted.desc": "All OAuth tokens are stored securely. Communications with the Mercado Livre API are made exclusively via HTTPS.",
    "settings.ml": "Mercado Livre Connection",
    "settings.ml.desc": "Manage OAuth connection with your Mercado Livre account",
    "settings.ml.connected": "Account connected",
    "settings.ml.expired": "Expired",
    "settings.ml.active": "Active",
    "settings.ml.tokenExpired": "Token expired",
    "settings.ml.tokenValid": "Token valid",
    "settings.ml.refresh": "Refresh Token",
    "settings.ml.disconnect": "Disconnect",
    "settings.ml.notConnected": "Mercado Livre not connected",
    "settings.ml.notConnected.desc": "Connect your account to start publishing products",
    "settings.ml.connect": "Connect Mercado Livre",
    "settings.ml.confirmDisconnect": "Are you sure you want to disconnect your Mercado Livre account?",

    // Reports
    "reports.title": "Reports",
    "reports.subtitle": "View and export operation reports",
    "reports.monthly": "Monthly Report",
    "reports.monthly.desc": "Summary of all operations for the selected month",
    "reports.selectMonth": "Select month",
    "reports.generate": "Generate Report",
    "reports.download": "Download PDF",
    "reports.noData": "No data found for the selected period",
    "reports.summary": "Period Summary",
    "reports.totalOperations": "Total Operations",
    "reports.successRate": "Success Rate",
    "reports.errors": "Errors",
    "reports.byType": "By Operation Type",
    "reports.byDay": "By Day",

    // Webhooks
    "webhooks.title": "Webhooks",
    "webhooks.subtitle": "Configure notifications for external systems",
    "webhooks.create": "Create Webhook",
    "webhooks.name": "Name",
    "webhooks.url": "URL",
    "webhooks.events": "Events",
    "webhooks.secret": "Secret (optional)",
    "webhooks.status": "Status",
    "webhooks.lastTriggered": "Last triggered",
    "webhooks.never": "Never",
    "webhooks.noWebhooks": "No webhooks configured",
    "webhooks.noWebhooks.desc": "Create a webhook to receive notifications about important events",
    "webhooks.logs": "Delivery History",
    "webhooks.event.publish_success": "Successful publication",
    "webhooks.event.publish_error": "Publication error",
    "webhooks.event.batch_import_complete": "Batch import complete",
    "webhooks.event.import_success": "Successful import",
    "webhooks.event.import_error": "Import error",
    "webhooks.event.token_refresh": "Token renewal",
    "webhooks.event.token_error": "Token error",
    "webhooks.confirmDelete": "Are you sure you want to delete this webhook?",
  },
};

const languageNames: Record<Language, string> = {
  "pt-BR": "Português (Brasil)",
  es: "Español",
  en: "English",
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: string) => string;
  languageNames: Record<Language, string>;
  loading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("pt-BR");
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Load user language preference
  useEffect(() => {
    const loadPreference = async () => {
      if (!user) {
        // Check localStorage for non-authenticated users
        const stored = localStorage.getItem("preferred-language") as Language;
        if (stored && translations[stored]) {
          setLanguageState(stored);
        }
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("user_preferences")
          .select("language")
          .eq("user_id", user.id)
          .maybeSingle();

        if (data?.language && translations[data.language]) {
          setLanguageState(data.language as Language);
        } else {
          // Fallback to localStorage
          const stored = localStorage.getItem("preferred-language") as Language;
          if (stored && translations[stored]) {
            setLanguageState(stored);
          }
        }
      } catch (error) {
        console.error("Error loading language preference:", error);
      } finally {
        setLoading(false);
      }
    };

    loadPreference();
  }, [user]);

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("preferred-language", lang);

    if (user) {
      try {
        const { error } = await supabase
          .from("user_preferences")
          .upsert({
            user_id: user.id,
            language: lang,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: "user_id",
          });

        if (error) {
          console.error("Error saving language preference:", error);
        }
      } catch (error) {
        console.error("Error saving language preference:", error);
      }
    }
  };

  const t = (key: string): string => {
    return translations[language]?.[key] || translations["pt-BR"]?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, languageNames, loading }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
