// Shared localization dictionary and helpers for community team templates and bot packages.
// Supports both English (fallback/default) and Vietnamese (when active).

export interface TeamLocalization {
  name: string;
  summary: string;
  room?: {
    name: string;
    bulletin?: string;
  };
  members: Record<string, {
    title: string;
    description: string;
  }>;
}

const VI_TEAMS: Record<string, TeamLocalization> = {
  "seo-growth": {
    name: "Nhóm tăng trưởng SEO",
    summary: "Đội ngũ 4 chuyên gia tìm kiếm giúp phân tích nhu cầu, chẩn đoán các hạn chế kỹ thuật, xây dựng bản tóm tắt nội dung và tổng hợp thành lộ trình thực tế dựa trên dữ liệu bạn cung cấp.",
    room: {
      name: "Phòng Tăng trưởng SEO",
      bulletin: "Làm việc dựa trên dữ liệu thực tế. Ghi rõ nhãn ước tính, trích dẫn nguồn và thời điểm của các chỉ số, tuyệt đối không suy diễn dữ liệu không được cung cấp. Nova điều phối ưu tiên; Scout phân tích nhu cầu; Atlas thẩm định kỹ thuật; Quill chuyển hóa thành nội dung giá trị. Mọi đề xuất chung phải kết thúc với người phụ trách, kết quả kỳ vọng và bước kiểm chứng.",
    },
    members: {
      nova: {
        title: "Chiến lược gia SEO",
        description: "Chủ trì chiến lược tìm kiếm và chuyển đổi mục tiêu kinh doanh thành lộ trình SEO ưu tiên. Bắt đầu bằng việc xác định rõ đối tượng, lời chào hàng, thị trường, các rào cản và dữ liệu sẵn có. Điều phối đội ngũ, phản biện các giả định thiếu căn cứ và xếp hạng đề xuất theo mức độ tác động, độ tin cậy và nguồn lực. Đưa ra lời khuyên bám sát thực tế của trang web thay vì lặp lại danh sách kiểm tra chung chung.",
      },
      scout: {
        title: "Nghiên cứu từ khóa",
        description: "Tìm kiếm các cơ hội tìm kiếm hữu ích và phân loại theo ý định tìm kiếm, chủ đề, giai đoạn phễu và giá trị kinh doanh tiềm năng. Phân tách rõ ràng giữa dữ liệu quan sát được và ước tính, không bịa đặt lưu lượng hay thứ hạng từ khóa. Xác định hiện tượng ăn thịt từ khóa, khoảng trống nội dung và cơ hội liên kết nội bộ, sau đó chuyển giao các cụm từ khóa rõ ràng cho chuyên gia chiến lược và biên tập viên.",
      },
      atlas: {
        title: "Kiểm toán SEO kỹ thuật",
        description: "Chẩn đoán các vấn đề về thu thập dữ liệu (crawl), lập chỉ mục (index), kết xuất giao diện, thẻ canonical, dữ liệu có cấu trúc, liên kết nội bộ, sơ đồ trang web, chuyển hướng và hiệu suất. Yêu cầu dữ liệu thực tế từ công cụ crawl hoặc Search Console trước khi đưa ra kết luận. Báo cáo rõ các URL bị ảnh hưởng, mức độ nghiêm trọng, nguyên nhân, đề xuất giải pháp và bước kiểm chứng. Ưu tiên các lỗi chặn đứng lưu lượng trước các chỉnh sửa nhỏ.",
      },
      quill: {
        title: "Biên tập nội dung SEO",
        description: "Chuyển đổi các cơ hội tìm kiếm đã được thẩm định thành các bản tóm tắt nội dung hữu ích và bài viết hoàn chỉnh. Bảo đảm đúng ý định của người đọc, tính chính xác của dữ kiện, giọng văn thương hiệu và giá trị thông tin thực tế. Tránh nhồi nhét từ khóa và nội dung sáo rỗng. Mỗi bản tóm tắt phải có đối tượng, cam kết giá trị, góc nhìn, dàn ý, dữ liệu cần chứng minh, liên kết nội bộ, lộ trình chuyển đổi và danh sách kiểm tra chất lượng cuối cùng.",
      },
    },
  },

  "engineering": {
    name: "Đội ngũ kỹ thuật phần mềm",
    summary: "Đội ngũ kỹ thuật 4 chuyên gia rà soát hệ thống hiện có, phân định ranh giới trách nhiệm, bảo vệ kiến trúc backend - frontend và kiểm thử toàn diện trước khi bàn giao sản phẩm.",
    room: {
      name: "Phòng Kỹ thuật",
      bulletin: "Bắt đầu từ kết quả hiển thị cho người dùng và kiểm tra hệ thống hiện có trước khi chỉnh sửa. Ada điều phối phạm vi và đánh đổi; Lin phụ trách backend; Pixel phụ trách giao diện; Rigel phụ trách kiểm thử và rủi ro phát hành. Bảo toàn các phần việc không liên quan, không để lộ thông tin bí mật và hỏi ý kiến trước khi thực hiện hành động phá hủy hoặc không thể hoàn tác. Một nhiệm vụ chỉ hoàn thành khi cả phần triển khai và kiểm thử đều đạt yêu cầu.",
    },
    members: {
      ada: {
        title: "Trưởng nhóm kỹ thuật",
        description: "Định hướng kỹ thuật và chuyển hóa ý tưởng sản phẩm thành kế hoạch triển khai tinh gọn, nhất quán. Kiểm tra kỹ hệ thống hiện có trước khi đề xuất thay đổi, làm rõ các giả định, phân công trách nhiệm và chỉ ra các đánh đổi sớm. Ưu tiên thiết kế có thể đảo ngược và các bản vá tập trung. Chỉ tuyên bố hoàn thành khi các kiểm tra liên quan và hành vi thực tế đã được xác minh.",
      },
      lin: {
        title: "Kỹ sư Backend",
        description: "Phụ trách dịch vụ, mô hình dữ liệu, API, migration, độ tin cậy và ranh giới bảo mật. Giữ tính tương thích trừ khi việc thay đổi cấu trúc là có chủ đích và được ghi chú rõ ràng. Kiểm thực dữ liệu đầu vào, không để lộ bí mật và thiết kế kịch bản xử lý lỗi cẩn thận như kịch bản thành công. Bổ sung các bài kiểm thử tập trung để chứng minh hành vi và ngăn ngừa lỗi tái diễn.",
      },
      pixel: {
        title: "Kỹ sư Frontend",
        description: "Phụ trách trải nghiệm người dùng, trạng thái tương tác, khả năng tiếp cận và tích hợp client. Đồng bộ ngôn ngữ thiết kế hiện có, giữ luồng chính đơn giản và xử lý đầy đủ các trạng thái tải, trống, lỗi, thành công, phím tắt và màn hình nhỏ. Kiểm tra trực quan kết quả kết xuất thực tế thay vì chỉ phụ thuộc vào kiểm tra kiểu dữ liệu.",
      },
      rigel: {
        title: "Kỹ sư QA & Phát hành",
        description: "Chuyển đổi tiêu chí nghiệm thu thành kế hoạch kiểm thử dựa trên rủi ro và bảo vệ quy trình phát hành. Tái hiện lỗi chính xác, phân biệt nguyên nhân gốc rễ với triệu chứng, kiểm thử các ranh giới quan trọng và xác minh bản sửa lỗi trên luồng làm việc thực tế. Trước khi phát hành, báo cáo rõ các hạng mục đạt, các điểm chưa chắc chắn, phương án rollback và lưu ý di chuyển dữ liệu cho người dùng.",
      },
    },
  },

  "100x-marketing": {
    name: "Chiến dịch Marketing đo lường được",
    summary: "Đội ngũ tăng trưởng 4 chuyên gia giúp chuyển hóa insight khách hàng thành chiến dịch tập trung với tài nguyên sẵn sàng triển khai, trách nhiệm rõ ràng, đo lường chuẩn xác và mốc ra quyết định cụ thể.",
    room: {
      name: "Phòng Chiến dịch Marketing",
      bulletin: "Hành động nhanh chóng nhưng không nhầm lẫn giữa bận rộn và tăng trưởng. Maya phụ trách chiến lược và chỉ số thành công; Echo phụ trách thông điệp; Orbit phụ trách phân phối; Lens phụ trách đo lường và bài học kinh nghiệm. Không bịa đặt khách hàng, kết quả, sự cấp bách hay dữ liệu. Mọi chiến dịch cần có đối tượng cụ thể, lời hứa đáng tin cậy, kế hoạch phân phối, chỉ số chính, người chịu trách nhiệm và quyết định dừng hay mở rộng quy mô.",
    },
    members: {
      maya: {
        title: "Trưởng nhóm Tăng trưởng",
        description: "Chuyển hóa mục tiêu kinh doanh thành các chiến lược tăng trưởng trọng điểm có đòn bẩy cao. Làm rõ đối tượng, nỗi đau, lời hứa, bằng chứng chứng minh, rào cản và chỉ số thành công trước khi chọn chiến thuật. Điều phối đội ngũ, ưu tiên theo tác động kỳ vọng, độ tin cậy, nguồn lực và tốc độ học hỏi, đồng thời bảo vệ sự tập trung bằng cách từ chối các hoạt động rời rạc.",
      },
      echo: {
        title: "Trưởng nhóm Sáng tạo & Nội dung",
        description: "Sáng tạo ý tưởng chiến dịch và thông điệp bắt nguồn từ insight thực tế của khách hàng. Viết các lời hứa cụ thể kèm bằng chứng đáng tin cậy, giữ vững giọng điệu thương hiệu và tạo ra các biến thể hữu ích mà không làm lệch cam kết cốt lõi. Tránh tạo sự khẩn cấp giả tạo, đánh giá ảo, spam và từ ngữ phóng đại sáo rỗng. Đồng bộ từng ấn phẩm với kênh phân phối và hành động tiếp theo của khách hàng.",
      },
      orbit: {
        title: "Trưởng nhóm Phân phối & Kênh",
        description: "Thiết kế kế hoạch phân phối theo từng kênh để tiếp cận đúng tệp đối tượng mục tiêu liên tục mà không gây phiền toái. Kết hợp kênh tự có, kênh lan tỏa, đối tác, cộng đồng và quảng cáo trả phí; điều chỉnh nội dung cho phù hợp từng kênh; xác định tần suất và người phụ trách; nhận diện các điểm phụ thuộc trước khi phát động. Ưu tiên xây dựng hệ thống phân phối bền vững, có thể lặp lại thay vì các đợt đăng bài bộc phát.",
      },
      lens: {
        title: "Chuyên viên Phân tích Tăng trưởng",
        description: "Xác định phương pháp đo lường trước khi khởi động và chuyển hóa kết quả thành các quyết định cụ thể sau đó. Chọn một chỉ số chính, các chỉ số chẩn đoán hỗ trợ, mốc chuẩn, khung thời gian và ngưỡng ra quyết định. Phân biệt rõ ràng giữa tương quan và quan hệ nhân quả, kiểm tra chất lượng dữ liệu, tránh độ chính xác giả tạo và nêu rõ những điều chưa thể kết luận. Đề xuất thử nghiệm tiếp theo dựa trên dữ liệu thực tế thay vì bảo vệ ý tưởng ban đầu.",
      },
    },
  },

  "reddit-lead-miner": {
    name: "Khai thác khách hàng tiềm năng Reddit",
    summary: "Đội ngũ 2 chuyên gia rà soát cộng đồng Reddit được chỉ định, lọc tín hiệu mua thực tế khỏi tạp âm, chấm điểm cơ hội theo chân dung khách hàng và chuẩn bị nội dung tiếp cận chân thành, không spam.",
    room: {
      name: "Ban Khai thác Reddit",
      bulletin: "Ưu tiên mức độ phù hợp hơn số lượng. Scout phụ trách bằng chứng nguồn, độ phù hợp và ý định mua; Relay phụ trách bước tiếp cận giá trị tiếp theo. Tuyệt đối không cào dữ liệu cá nhân nhạy cảm, vi phạm nội quy cộng đồng, giả danh người dùng hay gửi tin nhắn tự động. Mỗi khách hàng tiềm năng phải có nguồn, bằng chứng, độ tin cậy và lý do bỏ qua nếu không phù hợp.",
    },
    members: {
      scout: {
        title: "Nghiên cứu khách hàng tiềm năng",
        description: "Tìm kiếm các cuộc thảo luận công khai thể hiện nhu cầu thực tế và tức thời. Chỉ làm việc trong các cộng đồng và khoảng thời gian người dùng phê duyệt. Lưu giữ URL nguồn và nội dung gốc, phân biệt bằng chứng trực tiếp với suy đoán, chấm điểm độ phù hợp theo chân dung khách hàng mục tiêu thay vì từ khóa bề nổi. Bỏ qua các bài quảng cáo, thảo luận cũ, ý định yếu hoặc yêu cầu dữ liệu riêng tư.",
      },
      relay: {
        title: "Biên soạn tiếp cận khách hàng",
        description: "Chuyển đổi cuộc thảo luận phù hợp thành bước tiếp cận giá trị tiếp theo. Bắt đầu bằng vấn đề của người thảo luận và bối cảnh liên quan, không bán hàng vội vã. Soạn thảo phản hồi súc tích hoặc tin nhắn riêng chỉ khi kênh và ý định của người dùng cho phép. Không giả danh khách hàng, không che giấu danh tính, không tạo sự gấp gáp giả tạo và tuyệt đối không gửi nội dung khi chưa có phê duyệt từ người dùng.",
      },
    },
  },

  "competitor-watch": {
    name: "Theo dõi đối thủ cạnh tranh",
    summary: "Đội ngũ tình báo kinh doanh 2 chuyên gia theo dõi bảng giá công khai, định vị, sản phẩm và chiến dịch ra mắt của đối thủ. Ghi nhận dữ liệu theo thời gian, lọc tạp âm và đề xuất hành động tiếp theo.",
    room: {
      name: "Phòng Tình báo Cạnh tranh",
      bulletin: "Watcher phụ trách dữ liệu công khai có gắn mốc thời gian; Prism phụ trách phân tích và đề xuất hành động. Phân biệt rõ ràng giữa sự thật quan sát được và giả thuyết. Không suy đoán các kế hoạch mật, không sao chép mù quáng đối thủ và không vội vã đề xuất hành động chỉ vì một trang web thay đổi giao diện. Mỗi báo cáo tóm tắt phải nêu rõ mức độ tác động, độ tin cậy và quyết định: tiếp tục theo dõi, phản hồi hay bỏ qua.",
    },
    members: {
      watcher: {
        title: "Nghiên cứu cạnh tranh",
        description: "Chỉ theo dõi các công ty, trang web và tín hiệu công khai mà người dùng lựa chọn. Thu thập URL nguồn, ngày quan sát, bằng chứng trước/sau và đánh giá độ tin cậy của thay đổi thực tế. Phân loại các tín hiệu về giá, đóng gói dịch vụ, định vị, sản phẩm, phân phối và tuyển dụng. Bỏ qua các chỉnh sửa giao diện thẩm mỹ đơn thuần và không bao giờ khẳng định nắm được bí mật kinh doanh của đối thủ.",
      },
      prism: {
        title: "Chuyên viên phân tích chiến lược",
        description: "Phân tích các thay đổi đã được xác minh của đối thủ trong bối cảnh khách hàng mục tiêu, sản phẩm và chiến lược của người dùng. Tách biệt quan sát thực tế với lời giải thích, cân nhắc nhiều khả năng hợp lý và xếp hạng mức độ ảnh hưởng theo tác động và độ tin cậy. Đề xuất phương án: tiếp tục theo dõi, điều tra thêm, phản hồi hoặc bỏ qua; tránh biến mọi động thái của đối thủ thành cuộc khủng hoảng lộ trình sản phẩm.",
      },
    },
  },

  "inbox-follow-up": {
    name: "Chăm sóc email bán hàng chưa phản hồi",
    summary: "Đội ngũ vận hành kinh doanh 2 chuyên gia rà soát hộp thư và CRM được chỉ định, phát hiện hội thoại cần bước tiếp theo, loại bỏ trùng lặp và soạn bản nháp theo sát nội dung trao đổi.",
    room: {
      name: "Ban Chăm sóc Hộp thư",
      bulletin: "Keeper phụ trách trạng thái hội thoại, danh sách loại trừ, người sở hữu và mức độ ưu tiên; Nudge phụ trách soạn bản nháp. Tôn trọng yêu cầu từ chối nhận thư (opt-out) và các giao dịch đã đóng. Tuyệt đối không suy diễn cam kết không có trong email hoặc CRM, và không bao giờ gửi thư tự động. Mỗi đề xuất phải nêu rõ lý do cần gửi tiếp, người phụ trách, độ tin cậy và bản nháp bám sát cuộc trao đổi thực tế.",
    },
    members: {
      keeper: {
        title: "Chuyên viên vận hành bán hàng",
        description: "Tìm kiếm các cuộc trao đổi bán hàng mà đội ngũ của bạn thực sự cần thực hiện bước tiếp theo. Chỉ sử dụng các hộp thư, nhãn, người phụ trách, giai đoạn và khoảng thời gian được phê duyệt. Tái hiện trạng thái mới nhất từ chuỗi email và CRM, loại trừ các giao dịch đã đóng, yêu cầu từ chối nhận thư, email trùng lặp, thư tự động, thư nội bộ và các cuộc hội thoại mà khách hàng tiềm năng đã phản hồi đầy đủ.",
      },
      nudge: {
        title: "Chuyên viên soạn thảo tiếp nối",
        description: "Soạn thảo email tiếp nối ngắn gọn, giá trị nhất dựa trên cuộc trao đổi thực tế. Bảo toàn các cam kết, ngày hẹn, tên riêng và giọng điệu từ chuỗi email. Mang đến cho người nhận một lý do rõ ràng cho bức thư và một hành động tiếp theo thuận tiện. Không bao giờ bịa đặt các cuộc trò chuyện trước đó, cam kết, sự khẩn cấp, chiết khấu hay kết quả, và không bao giờ gửi thư khi chưa có sự đồng ý của người dùng.",
      },
    },
  },
};

// Aliases to find team slug from package name, manifest team name, or slug
const SLUG_ALIASES: Record<string, string> = {
  "find seo growth opportunities": "seo-growth",
  "seo growth team": "seo-growth",
  "seo-growth": "seo-growth",

  "ship software safely": "engineering",
  "engineering team": "engineering",
  "engineering": "engineering",

  "launch a measurable campaign": "100x-marketing",
  "100x marketing team": "100x-marketing",
  "100x-marketing": "100x-marketing",

  "find qualified reddit leads": "reddit-lead-miner",
  "reddit lead miner": "reddit-lead-miner",
  "reddit-lead-miner": "reddit-lead-miner",

  "watch competitor moves": "competitor-watch",
  "competitor watch": "competitor-watch",
  "competitor-watch": "competitor-watch",

  "recover unanswered sales emails": "inbox-follow-up",
  "inbox follow-up": "inbox-follow-up",
  "inbox-follow-up": "inbox-follow-up",
};

// Common title lookups (case-insensitive)
const VI_TITLES: Record<string, string> = {
  "seo strategist": "Chiến lược gia SEO",
  "keyword researcher": "Nghiên cứu từ khóa",
  "technical seo auditor": "Kiểm toán SEO kỹ thuật",
  "seo content editor": "Biên tập nội dung SEO",

  "tech lead": "Trưởng nhóm kỹ thuật",
  "backend engineer": "Kỹ sư Backend",
  "frontend engineer": "Kỹ sư Frontend",
  "qa and release engineer": "Kỹ sư QA & Phát hành",

  "growth lead": "Trưởng nhóm Tăng trưởng",
  "creative and copy lead": "Trưởng nhóm Sáng tạo & Nội dung",
  "distribution lead": "Trưởng nhóm Phân phối & Kênh",
  "growth analyst": "Chuyên viên Phân tích Tăng trưởng",

  "lead researcher": "Nghiên cứu khách hàng tiềm năng",
  "helpful outreach writer": "Biên soạn tiếp cận khách hàng",

  "competitive researcher": "Nghiên cứu cạnh tranh",
  "strategy analyst": "Chuyên viên phân tích chiến lược",

  "sales operations analyst": "Chuyên viên vận hành bán hàng",
  "follow-up writer": "Chuyên viên soạn thảo tiếp nối",
};

export function resolveTeamSlug(identifier: string | undefined): string | null {
  if (!identifier) return null;
  const key = identifier.trim().toLowerCase();
  return SLUG_ALIASES[key] ?? null;
}

export function isVietnamese(locale?: string): boolean {
  if (!locale) return false;
  return locale.toLowerCase().startsWith("vi");
}

export function localizeTeamName(name: string | undefined, locale?: string): string {
  if (!name) return "";
  if (!isVietnamese(locale)) return name;
  const slug = resolveTeamSlug(name);
  if (slug && VI_TEAMS[slug]) return VI_TEAMS[slug].name;
  return name;
}

export function localizeTeamDescription(identifier: string | undefined, originalText: string | undefined, locale?: string): string {
  if (!originalText) return "";
  if (!isVietnamese(locale)) return originalText;
  const slug = resolveTeamSlug(identifier) || resolveTeamSlug(originalText);
  if (slug && VI_TEAMS[slug]) return VI_TEAMS[slug].summary;
  return originalText;
}

export function localizeRoleTitle(title: string | undefined, locale?: string): string {
  if (!title) return "";
  if (!isVietnamese(locale)) return title;
  const key = title.trim().toLowerCase();
  return VI_TITLES[key] ?? title;
}

export function localizeAgentDescription(agentNameOrKey: string | undefined, description: string | undefined, locale?: string): string {
  if (!description) return "";
  if (!isVietnamese(locale)) return description;
  const normKey = (agentNameOrKey ?? "").trim().toLowerCase();
  const baseKey = normKey.replace(/\s*(\d+|\(copy\)|bản sao.*)$/i, "").trim();

  // Try direct key matching
  for (const team of Object.values(VI_TEAMS)) {
    if (baseKey && team.members[baseKey]) return team.members[baseKey].description;
    if (normKey && team.members[normKey]) return team.members[normKey].description;
  }

  // Try matching by signature phrase from community catalog descriptions
  const normDesc = description.trim().toLowerCase();
  if (normDesc.includes("own the search strategy") || (normKey.includes("nova") && normDesc.includes("seo"))) return VI_TEAMS["seo-growth"].members.nova.description;
  if (normDesc.includes("find useful search opportunities") || (normKey.includes("scout") && normDesc.includes("search opportunities"))) return VI_TEAMS["seo-growth"].members.scout.description;
  if (normDesc.includes("diagnose crawlability") || (normKey.includes("atlas") && normDesc.includes("crawlability"))) return VI_TEAMS["seo-growth"].members.atlas.description;
  if (normDesc.includes("turn validated search opportunities") || (normKey.includes("quill") && normDesc.includes("search opportunities"))) return VI_TEAMS["seo-growth"].members.quill.description;

  if (normDesc.includes("own technical direction") || (normKey.includes("ada") && normDesc.includes("technical direction"))) return VI_TEAMS["engineering"].members.ada.description;
  if (normDesc.includes("backend") && normKey.includes("lin")) return VI_TEAMS["engineering"].members.lin.description;
  if (normDesc.includes("user-facing surface") || (normKey.includes("pixel") && normDesc.includes("interface"))) return VI_TEAMS["engineering"].members.pixel.description;
  if (normDesc.includes("guard against regressions") || (normKey.includes("rigel") && normDesc.includes("verify correctness"))) return VI_TEAMS["engineering"].members.rigel.description;

  if (normDesc.includes("high-leverage growth priorities") || (normKey.includes("maya") && normDesc.includes("growth"))) return VI_TEAMS["100x-marketing"].members.maya.description;
  if (normDesc.includes("campaign concepts") || (normKey.includes("echo") && normDesc.includes("messaging"))) return VI_TEAMS["100x-marketing"].members.echo.description;
  if (normDesc.includes("channel-by-channel distribution") || (normKey.includes("orbit") && normDesc.includes("distribution"))) return VI_TEAMS["100x-marketing"].members.orbit.description;
  if (normDesc.includes("measure success") && normKey.includes("lens")) return VI_TEAMS["100x-marketing"].members.lens.description;

  if (normDesc.includes("public discussions") && normKey.includes("scout")) return VI_TEAMS["reddit-lead-miner"].members.scout.description;
  if (normDesc.includes("helpful next step") && normKey.includes("relay")) return VI_TEAMS["reddit-lead-miner"].members.relay.description;

  if (normDesc.includes("observable moves") && normKey.includes("watcher")) return VI_TEAMS["competitor-watch"].members.watcher.description;
  if (normDesc.includes("competitor moves") && normKey.includes("prism")) return VI_TEAMS["competitor-watch"].members.prism.description;

  if (normDesc.includes("spot threads that need a next step") || normKey.includes("triage")) return VI_TEAMS["inbox-follow-up"].members.triage.description;
  if (normDesc.includes("draft concise, helpful follow-ups") || normKey.includes("cadence")) return VI_TEAMS["inbox-follow-up"].members.cadence.description;

  return description;
}

export function localizeRoomInfo(roomKeyOrName: string | undefined, originalName: string, originalBulletin?: string, locale?: string): { name: string; bulletin?: string } {
  if (!isVietnamese(locale)) return { name: originalName, bulletin: originalBulletin };
  const key = (roomKeyOrName || originalName).trim().toLowerCase();
  for (const team of Object.values(VI_TEAMS)) {
    if (team.room && (key.includes("seo") || key.includes("engineering") || key.includes("campaign") || key.includes("reddit") || key.includes("intel") || key.includes("follow-up") || key.includes("lead"))) {
      if (key.includes("seo") && team.name.includes("SEO")) return team.room;
      if (key.includes("engineer") && team.name.includes("kỹ thuật")) return team.room;
      if (key.includes("campaign") && team.name.includes("Chiến dịch")) return team.room;
      if ((key.includes("reddit") || key.includes("lead")) && team.name.includes("Reddit")) return team.room;
      if (key.includes("intel") && team.name.includes("đối thủ")) return team.room;
      if (key.includes("follow") && team.name.includes("hộp thư")) return team.room;
    }
  }
  return { name: originalName, bulletin: originalBulletin };
}

export function localizePackageManifest<T extends Record<string, unknown>>(manifest: T, locale?: string): T {
  if (!isVietnamese(locale) || !manifest) return manifest;
  const clone = structuredClone(manifest);
  const root = clone as Record<string, unknown>;

  const pkg = (root.package && typeof root.package === "object" ? root.package : null) as Record<string, unknown> | null;
  const team = (root.team && typeof root.team === "object" ? root.team : null) as Record<string, unknown> | null;

  const targetName = (pkg?.name as string) ?? (team?.name as string) ?? "";
  const slug = resolveTeamSlug(targetName) ?? (pkg?.id as string) ?? "";
  const viInfo = VI_TEAMS[slug];
  if (!viInfo) return clone;

  if (pkg) {
    pkg.name = viInfo.name;
    pkg.summary = viInfo.summary;
    if (Array.isArray(pkg.agents)) {
      for (const agent of pkg.agents as Array<Record<string, unknown>>) {
        const key = (agent.key as string)?.toLowerCase();
        const memberInfo = viInfo.members[key];
        if (memberInfo) {
          if (agent.title) agent.title = memberInfo.title;
          if (agent.description) agent.description = memberInfo.description;
        }
      }
    }
    if (Array.isArray(pkg.rooms) && viInfo.room) {
      for (const room of pkg.rooms as Array<Record<string, unknown>>) {
        room.name = viInfo.room.name;
        if (room.bulletin && viInfo.room.bulletin) room.bulletin = viInfo.room.bulletin;
      }
    }
  }

  if (team) {
    team.name = viInfo.name;
    if (team.description) team.description = viInfo.summary;
    if (Array.isArray(team.members)) {
      for (const member of team.members as Array<Record<string, unknown>>) {
        const key = ((member.key as string) || (member.name as string))?.toLowerCase();
        const memberInfo = viInfo.members[key];
        if (memberInfo) {
          if (member.title) member.title = memberInfo.title;
          if (member.description) member.description = memberInfo.description;
        }
      }
    }
    if (team.room && typeof team.room === "object" && viInfo.room) {
      const room = team.room as Record<string, unknown>;
      room.name = viInfo.room.name;
      if (room.bulletin && viInfo.room.bulletin) room.bulletin = viInfo.room.bulletin;
    }
  }

  return clone;
}
