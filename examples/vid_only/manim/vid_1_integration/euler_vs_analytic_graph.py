from __future__ import annotations

from dataclasses import dataclass

from manim import *


@dataclass
class FallParams:
        g: float = -9.81
        y0: float = 30.0
        v0: float = 0.0
        total_time: float = 2.25
        dt: float = 0.45


class EulerVsAnalyticFall(Scene):
        def construct(self) -> None:
                params = FallParams()

                axes = Axes(
                        x_range=[0, params.total_time + 0.5, 0.5],
                        y_range=[0, params.y0 + 2, 5],
                        x_length=9.5,
                        y_length=6,
                        axis_config={"tip_length": 0.18},
                )

                x_label = MathTex(r"t\,(\text{s})").next_to(axes.x_axis, DOWN, buff=0.25)
                y_label = MathTex(r"y\,(\text{m})").next_to(axes.y_axis, LEFT, buff=0.25)

                legend = self._build_legend()
                legend.to_corner(UR, buff=0.4)

                self.play(FadeIn(axes), FadeIn(x_label), FadeIn(y_label), FadeIn(legend))

                analytic_graph = axes.plot(
                        lambda t: params.y0 + params.v0 * t + 0.5 * params.g * t * t,
                        color=YELLOW,
                        use_smoothing=True,
                )

                euler_curve, euler_dots = self._build_euler_staircase(axes, params)

                self.play(Create(analytic_graph), run_time=4.0)
                self.play(Create(euler_curve), FadeIn(euler_dots, lag_ratio=0.15), run_time=5.0)

                self.wait(0.5)

                final_t = params.total_time
                analytic_final = axes.coords_to_point(
                        final_t,
                        params.y0 + params.v0 * final_t + 0.5 * params.g * final_t * final_t,
                )
                euler_final = euler_dots[-1].get_center()

                error_line = Line(analytic_final, euler_final)
                error_brace = Brace(error_line, direction=LEFT, color=RED)
                error_label = Tex("Euler error", color=RED, font_size=34)
                error_label.next_to(error_brace, LEFT, buff=0.2)

                dotted_line = DashedLine(analytic_final, euler_final, color=RED, stroke_width=6, dash_length=0.2, dashed_ratio=0.75)
                dotted_line.set_z_index(10)

                self.play(Create(dotted_line), run_time=0.67)
                self.play(FadeIn(error_brace), FadeIn(error_label))

                self.wait(2)

        def _build_euler_staircase(self, axes: Axes, params: FallParams) -> tuple[VMobject, VGroup]:
                samples: list[tuple[float, float]] = [(0.0, params.y0)]
                current_t = 0.0
                current_y = params.y0
                current_v = params.v0

                while current_t < params.total_time - 1e-9:
                        dt = min(params.dt, params.total_time - current_t)
                        current_v = current_v + params.g * dt
                        next_t = current_t + dt
                        next_y = current_y + current_v * dt

                        samples.append((next_t, next_y))

                        current_t = next_t
                        current_y = next_y

                staircase_points = [axes.coords_to_point(*samples[0])]
                for (t_prev, y_prev), (t_curr, y_curr) in zip(samples[:-1], samples[1:]):
                        staircase_points.append(axes.coords_to_point(t_curr, y_prev))
                        staircase_points.append(axes.coords_to_point(t_curr, y_curr))

                euler_curve = VMobject(color=BLUE_C)
                euler_curve.set_points_as_corners(staircase_points)

                sample_dots = VGroup(
                        *[Dot(axes.coords_to_point(t_val, y_val), color=BLUE_C, radius=0.06) for t_val, y_val in samples]
                )

                return euler_curve, sample_dots

        def _build_legend(self) -> VGroup:
                analytic_key = VGroup(Line(ORIGIN, 0.9 * RIGHT, color=YELLOW), Tex("Analytic solution", font_size=30))
                analytic_key.arrange(RIGHT, buff=0.3)

                euler_key = VGroup(Line(ORIGIN, 0.9 * RIGHT, color=BLUE_C), Tex("Euler samples", font_size=30))
                euler_key.arrange(RIGHT, buff=0.3)

                return VGroup(analytic_key, euler_key).arrange(DOWN, aligned_edge=LEFT, buff=0.2)
