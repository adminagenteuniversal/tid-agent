/**
 * GESTOR DE ESTADÍSTICAS SEMANALES
 * Calcula métricas en tiempo real:
 * - Cantidad de usuarios atendidos en la semana (totales y únicos)
 * - Distribución por ecosistema (Web, APK, Web App, etc.)
 * - Análisis de objetivos atendidos
 * - Análisis de resultados alcanzados
 */

import { interviewsManager } from "./interviews-manager.js";

class StatsManager {
  /**
   * Filtra las entrevistas pertenecientes a la semana en curso (últimos 7 días)
   */
  filterThisWeek(interviews) {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return interviews.filter(item => {
      const time = new Date(item.fechaActividad || item.fechaInicio).getTime();
      return time >= oneWeekAgo;
    });
  }

  /**
   * Genera el informe estadístico semanal completo
   */
  async getWeeklyReport() {
    const allInterviews = await interviewsManager.getAllInterviews();
    const weeklyInterviews = this.filterThisWeek(allInterviews);

    // 1. Usuarios únicos y total de sesiones
    const uniqueUserIds = new Set();
    const uniqueExpedientes = new Set();
    const ecosistemasMap = {};
    const objetivosList = [];
    const resultadosList = [];
    const identidadesMap = {};
    const dailyCounts = { "Lun": 0, "Mar": 0, "Mié": 0, "Jue": 0, "Vie": 0, "Sáb": 0, "Dom": 0 };

    const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

    weeklyInterviews.forEach(inv => {
      if (inv.usuarioId) uniqueUserIds.add(inv.usuarioId);
      if (inv.numeroExpediente) uniqueExpedientes.add(inv.numeroExpediente);

      // Ecosistema
      const eco = inv.ecosistema || "Web Principal";
      ecosistemasMap[eco] = (ecosistemasMap[eco] || 0) + 1;

      // Identidad
      const ident = inv.identidadNombre || "Agente General";
      identidadesMap[ident] = (identidadesMap[ident] || 0) + 1;

      // Objetivos y resultados
      if (inv.objetivos) objetivosList.push(inv.objetivos);
      if (inv.resultados) resultadosList.push(inv.resultados);

      // Día de la semana
      const date = new Date(inv.fechaActividad || inv.fechaInicio);
      const dayName = dayNames[date.getDay()];
      if (dailyCounts[dayName] !== undefined) {
        dailyCounts[dayName]++;
      }
    });

    return {
      totalEntrevistasSemana: weeklyInterviews.length,
      totalUsuariosUnicos: uniqueUserIds.size || uniqueExpedientes.size,
      totalHistorico: allInterviews.length,
      distribucionEcosistemas: ecosistemasMap,
      distribucionIdentidades: identidadesMap,
      conteoPorDia: dailyCounts,
      ultimosObjetivos: objetivosList.slice(0, 10),
      ultimosResultados: resultadosList.slice(0, 10),
      entrevistasSemana: weeklyInterviews
    };
  }
}

export const statsManager = new StatsManager();
